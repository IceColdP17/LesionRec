"""
Chatbot service for answering skincare and dermatology questions
Uses Google's Gemini API for intelligent responses
"""

import os
import logging
from typing import Optional, List, Dict
import google.generativeai as genai

logger = logging.getLogger(__name__)


class SkinHealthChatbot:
    """AI-powered chatbot for skin health questions"""

    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-pro")
        
        self.system_prompt = """You are an expert dermatology assistant and skincare expert. 
Your role is to provide accurate, helpful information about:
- Skin conditions and their causes
- Skincare routines and habits
- Active ingredients and their benefits
- Product recommendations and alternatives
- General dermatological advice
- Treatment options and when to see a dermatologist

Guidelines:
1. Provide evidence-based advice
2. Always recommend consulting a dermatologist for serious conditions
3. Be empathetic and encouraging
4. Explain terms in simple language
5. Give actionable tips and routines
6. Consider individual skin types (oily, dry, sensitive, combination, etc.)
7. Be honest about limitations and when professional help is needed

Keep responses concise but informative (2-3 paragraphs max).
Use bullet points for lists when helpful.
Maintain a friendly, supportive tone."""

    def chat(self, user_message: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
        """
        Get a response from the chatbot
        
        Args:
            user_message: The user's question or message
            conversation_history: Optional list of previous messages in format [{"role": "user"/"assistant", "content": "..."}]
        
        Returns:
            The chatbot's response
        """
        try:
            # Build the full prompt with conversation history
            if conversation_history:
                messages = self._build_messages_from_history(conversation_history)
                full_prompt = "\n".join(messages) + f"\n\nUser: {user_message}"
            else:
                full_prompt = f"{self.system_prompt}\n\nUser: {user_message}"
            
            # Generate response
            response = self.model.generate_content(full_prompt)
            
            # Extract text from response
            bot_response = response.text
            
            logger.info(f"Chat response generated successfully")
            return bot_response
            
        except Exception as e:
            logger.error(f"Error generating chat response: {e}")
            raise

    def _build_messages_from_history(self, conversation_history: List[Dict[str, str]]) -> List[str]:
        """Convert conversation history to message format"""
        messages = [self.system_prompt]
        
        for msg in conversation_history[-5:]:  # Keep last 5 messages for context
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                messages.append(f"User: {content}")
            else:
                messages.append(f"Assistant: {content}")
        
        return messages
