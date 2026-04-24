import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import certifi # Sometimes required for Windows/Mac SSL

async def test_connection():
    # Your exact connection string
    url = "mongodb+srv://rishidave:Ptmadhav55@rishi.tqmy3zl.mongodb.net/?appName=Rishi"
    
    print("1. Attempting to connect to MongoDB Atlas...")
    # Using certifi to force SSL verification just in case
    client = AsyncIOMotorClient(url, tlsCAFile=certifi.where())
    db = client["WearableProject"]
    
    try:
        print("2. Connected to Atlas. Searching for SensorData collection...")
        # Try to count the documents
        count = await db.SensorData.count_documents({})
        print(f"\n✅ SUCCESS! Found {count} documents in the database.")
        
        # Try to print just the very first document
        first_doc = await db.SensorData.find_one()
        print("\nHere is your first document:")
        print(first_doc)
        
    except Exception as e:
        print(f"\n❌ ERROR: MongoDB blocked the connection. Reason:\n{e}")

# Run the test
asyncio.run(test_connection())