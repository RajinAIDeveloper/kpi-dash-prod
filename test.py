import requests

def fetch_data(url, querystring, response):
 
    response = requests.request("GET",url, params=querystring)
    return response.text  # Raise an error for bad responses


client = OpenAI(api_key="your_api_key_here")

function_definition = [
    {"type": "function","function":{
        "name": "artwork recommendation",
        "description": "Fetches artwork recommendations based on a theme",
        "parameters": {
            "type": "object",
            "properties": {
                "artwordkeyword": {
                    "type": "string",
                    "description": "The theme or keyword for the artwork recommendation"
                }
            }
        },
        "result": { "type": "string", "description": "The recommended artwork based on the provided keyword" }
    }}
]

client.chat.completions.create(model="gpt-4o", messages=[
    {"role": "system", "content": "You are a helpful assistant that can fetch data from external APIs. specifically for art recommendations."},
    {"role": "user", "content": "Hello! Can you recommend me something related to sea?"}
],


)