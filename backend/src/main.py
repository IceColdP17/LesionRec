# ---- IMPORTS ----------
# Standard Python Libraries
import os                       # To read environment variables
import logging                  # For logging
import io                       # To handle byte streams
import requests                 # For making HTTP requests
import re                       # For regex validation
import time                     # For performance tracking

# Third-Party Libraries
from dotenv import load_dotenv      # To load environment variables from a .env file
from fastapi import FastAPI, UploadFile, File, HTTPException, Form  # FastAPI for API (Web Framework)
from fastapi.middleware.cors import CORSMiddleware      # For security rules for browser requests
from pydantic import BaseModel      # For request body validation
from typing import Optional, List   # For type hints
import boto3                        # AWS SDK (For S3 and Auth)

# Our Local Modules
from src.services.privacy import scrub_image_metadata
from src.services.analysis import perform_ensemble_analysis
from src.services.product_recommender import ProductRecommender
from src.services.image_processor import ImageProcessor
from src.services.chatbot import SkinHealthChatbot

# ---- Configuration -------
# Set up the logger. "INFO" just means show me everything important
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg"]
DEBUG_MODE = os.getenv("DEBUG", "False").lower() == "true"

# Create the App Instance. This IS the server
app = FastAPI(title="Lumina API")

# Initialize ProductRecommender with error handling
try:
    recommender = ProductRecommender()
    logger.info("✓ ProductRecommender initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize ProductRecommender: {e}")
    recommender = None

# Initialize Chatbot with error handling
try:
    chatbot = SkinHealthChatbot()
    logger.info("✓ SkinHealthChatbot initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize SkinHealthChatbot: {e}")
    chatbot = None

# ---- Security (CORS) ----
# **Browsers block requests from different ports 5173 and 8000 by default**
# This tells the browser to accept requests from localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- INFRASTRUCTURE (S3) ----
# Initialize a connection to AWS *once* when the server starts
try:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION")
    )
    BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
    logger.info("✓ S3 Client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize S3 client: {e}")
    s3_client = None

# ----- ENDPOINTS --------
@app.get("/")
async def health_check():
    """Health check endpoint to verify server is running"""
    return {
        "status": "healthy",
        "recommender_available": recommender is not None,
        "s3_available": s3_client is not None
    }

from typing import Optional

# ...existing code...

@app.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    budget_max: Optional[float] = Form(None),  # Default None (Infinite)
    bundle_mode: bool = Form(True)    # Bundle products by default
):
    """
    Upload and analyze skin image with product recommendations

    Args:
        file: Image file (JPEG/PNG)
        user_id: User identifier
        budget_max: Maximum budget for product recommendations (None = Infinite)
        bundle_mode: True for bundled products, False for individual items

    Returns:
        Analysis results and product recommendations
    """
    request_start = time.time()

    # Step 1: Validate S3 availability
    if not s3_client:
        logger.error("S3 client is not initialized")
        raise HTTPException(
            status_code=500,
            detail="Server configuration error: S3 not available"
        )

    try:
        # Step 2: Read and validate file
        logger.info(f"Receiving file {file.filename} for user {user_id}")
        original_image = await file.read()

        # Validate file size
        if len(original_image) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )

        # Validate file type
        if file.content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {ALLOWED_FILE_TYPES}"
            )

        # Validate user_id format
        if not re.match(r'^[a-zA-Z0-9_-]+$', user_id):
            raise HTTPException(
                status_code=400,
                detail="Invalid user_id format. Use alphanumeric, dash, or underscore only"
            )

        # Step 3: Scrub image metadata (privacy)
        logger.info("Scrubbing image metadata...")
        scrubbed_image = scrub_image_metadata(original_image)

        # Step 4: AI Analysis (Ensemble: Gemini + Google Vision)
        logger.info("Sending image to AI Ensemble...")
        analysis_start = time.time()
        analysis_result = await perform_ensemble_analysis(scrubbed_image, file.content_type)
        analysis_time = time.time() - analysis_start
        logger.info(f"AI analysis completed in {analysis_time:.2f}s")

        # Step 5: Upload scrubbed image to S3
        file_key = f"uploads/{user_id}/{file.filename}"
        logger.info(f"Uploading to S3: {BUCKET_NAME}/{file_key}")

        file_obj = io.BytesIO(scrubbed_image)
        s3_client.upload_fileobj(
            file_obj,
            BUCKET_NAME,
            file_key
        )

        # Generate a presigned URL for the uploaded file
        # This allows the frontend to access the private S3 object securely for a limited time (e.g., 1 hour)
        s3_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': file_key},
            ExpiresIn=3600  # URL expires in 1 hour
        )
        logger.info(f"✓ Upload successful. Presigned URL generated.")

        # Step 6: Get product recommendations
        if recommender is None:
            logger.warning("ProductRecommender not available")
            recommendations = {
                "error": "Product recommendation service temporarily unavailable",
                "bundle": [],
                "message": "Please try again later"
            }
        elif bundle_mode:
            logger.info("Creating product bundle...")
            recommendations = recommender.create_product_bundle_from_analysis(
                gemini_analysis=analysis_result['analysis'],
                budget_max=budget_max
            )
        else:
            logger.info("Getting individual product recommendations...")
            recommendations = recommender.recommend_from_analysis(
                gemini_analysis=analysis_result['analysis'],
                budget_max=budget_max,
                top_n=5
            )

        # Step 7: Return combined result
        total_time = time.time() - request_start
        logger.info(f"✓ Request completed in {total_time:.2f}s")

        return {
            "message": "Upload and analysis successful",
            "s3_path": s3_url,
            "filename": file.filename,
            "ai_analysis": analysis_result,
            "product_recommendations": recommendations,
            "metadata": {
                "user_id": user_id,
                "budget_max": budget_max,
                "bundle_mode": bundle_mode,
                "processing_time": round(total_time, 2),
                "analysis_time": round(analysis_time, 2)
            }
        }

    # Specific error handlers
    except AttributeError as e:
        logger.error(f"Recommender method error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Recommendation service error"
        )

    except KeyError as e:
        logger.error(f"Missing analysis data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Analysis incomplete - missing expected data"
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Storage service unavailable"
        )

    except ValueError as e:
        logger.error(f"Invalid data: {e}")
        raise HTTPException(
            status_code=400,
            detail="Invalid image data"
        )

    # Catch-all handler
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        detail = str(e) if DEBUG_MODE else "Internal server error"
        raise HTTPException(
            status_code=500,
            detail=detail
        )

class RecommendationRequest(BaseModel):
    analysis_text: str
    budget_max: Optional[float] = None

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    user_id: str
    message: str
    conversation_history: Optional[List[ChatMessage]] = None

@app.post("/recommend")
async def get_recommendations(request: RecommendationRequest):
    """
    Get product recommendations based on existing analysis text
    """
    if not recommender:
        raise HTTPException(status_code=503, detail="Recommendation service unavailable")
        
    try:
        logger.info(f"Generating bundle for budget: {request.budget_max}")
        recommendations = recommender.create_product_bundle_from_analysis(
            gemini_analysis=request.analysis_text,
            budget_max=request.budget_max
        )
        return recommendations
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint for skin health Q&A
    
    Args:
        user_id: User identifier
        message: User's message/question
        conversation_history: Optional conversation history for context
    
    Returns:
        Response from the AI chatbot
    """
    if not chatbot:
        raise HTTPException(status_code=503, detail="Chatbot service unavailable")
    
    try:
        logger.info(f"Chat request from user {request.user_id}: {request.message[:100]}...")
        
        # Convert ChatMessage objects to dict format for chatbot
        history = None
        if request.conversation_history:
            history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.conversation_history
            ]
        
        # Get response from chatbot
        response = chatbot.chat(request.message, history)
        
        logger.info("Chat response generated successfully")
        return {
            "response": response,
            "user_id": request.user_id
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

