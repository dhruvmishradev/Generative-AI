from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_mistralai import ChatMistralAI
from pydantic import BaseModel
from typing import List, Optional
from langchain_core.output_parsers import PydanticOutputParser

load_dotenv()


class Movie(BaseModel):
    title: str
    release_year: Optional[int]
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
Extract Movie Information from the Paragraph.

{format_instructions}
            """
        ),
        (
            "human",
            "{paragraph}"
        )
    ]
)

para = input("Give Your Paragraph: ")

final_prompt = prompt.invoke(
    {
        "paragraph": para,
        "format_instructions": parser.get_format_instructions()
    }
)

response = model.invoke(final_prompt)
moive_data = parser.parse(response.content)
print(response.content)