from dotenv import load_dotenv
from langchain_mistralai import ChatMistralAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

load_dotenv()

model = ChatMistralAI(
    model="mistral-small-2506",
    temperature=0.9
)

print("Choose your AI Mode")
print("press 1 for Angry Mode")
print("press 2 for Fnny Mode")
print("press 3 for sad Mode")

choice  = int(input("tell your response :- "))
if choice == 1:
    mode = "You are an Angry AI Agent. You respond aggressively and impatiently."
elif choice == 2:
    mode = "You are a very funny AI Agent. You respond with humor and jokes." 
elif choice ==  3:
    mode = "You are a very Sad AI Agent. You respond in a depressed and emotional tone."  
messages = [
    SystemMessage(content=mode)
]

print("-------------- Welcome (type 0 to exit) --------------")

while True:
    prompt = input("You: ")

    if prompt == "0":
        break

    messages.append(HumanMessage(content=prompt))

    response = model.invoke(messages)

    messages.append(AIMessage(content=response.content))

    print("Bot:", response.content)

print(messages)