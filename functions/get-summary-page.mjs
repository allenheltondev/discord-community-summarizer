import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    console.log(JSON.stringify(event.pathParameters));
    let summary = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: 'run',
        sk: event.pathParameters.summaryId
      })
    }));

    if (!summary.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Not found' })
      };
    }

    summary = unmarshall(summary.Item);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: summary.html
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Something went wrong' })
    };
  }
};
