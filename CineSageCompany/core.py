from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_mistralai import ChatMistralAI
from pydantic import BaseModel
from typing import List,Optional
from langchain_core.output_parsers import PydanticOutputParser
load_dotenv()

class Movie(BaseModel):
    title: str
    release_year : Optional[int]
    genre: List[str]
    director: Optional[str]
    cast: List[str]
    rating: Optional[float]
    summary: str




model = ChatMistralAI(
    model="mistral-small-2506",
    temperature=0.9
)


parser = PydanticOutputParser(pydantic_object=Movie)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are a Professional Information Extraction Assistant.

Your Task:
Extract the most useful and relevant information from the given paragraph and present it in a clean, well-structured format.

Rules:
- Read the entire paragraph carefully.
- Extract ONLY information explicitly mentioned.
- Do NOT hallucinate or assume missing information.
- If any information is unavailable, write "Not Mentioned".
- Keep summaries concise and factual.
- Preserve names, dates, numbers, and titles exactly as written.
- Do NOT add explanations or extra commentary.
- Organize the output with proper headings.
- Use bullet points where appropriate.
"""
        ),
        (
            "human",
            """
Extract useful information from the following paragraph.

{paragraph}
"""
        )
    ]
)

para = input("Give Your Paragraph: ")

final_prompt = prompt.invoke(
    {
        "paragraph": para
    }
)

response = model.invoke(final_prompt)

print(response.content)