import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getMomentoClient } from "./utils/helpers.mjs";
import { CacheListFetch } from '@gomomento/sdk';

const ddb = new DynamoDBClient();
let cacheClient;

export const handler = async (event) => {
  try {
    const summaries = await getSummaries();
    const lastRun = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: 'lastRun',
        sk: 'details'
      })
    }));

    let defaultDate;
    if (lastRun.Item) {
      defaultDate = new Date(unmarshall(lastRun.Item).date).toISOString();
    }

    const summaryPage = buildSummaryPage(defaultDate, summaries);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: summaryPage
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Something went wrong' })
    };
  }
};

const getSummaries = async () => {
  cacheClient = await getMomentoClient();
  let summaries = await cacheClient.listFetch('bis', 'summaries');
  if (summaries instanceof CacheListFetch.Hit) {
    summaries = summaries.valueList().map(summary => JSON.parse(summary));
  } else {
    const response = await ddb.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: marshall({
        ':pk': 'run'
      })
    }));

    summaries = response.Items.map(item => {
      const data = unmarshall(item);
      return {
        id: data.sk,
        date: data.runDate,
        title: `[${data.mode}] ${new Date(data.runDate).toLocaleDateString()} ${new Date(data.runDate).toLocaleTimeString()}`
      };
    }).sort((a, b) => new Date(b) - new Date(a));

    await cacheClient.listConcatenateBack('bis', 'summaries', summaries.map(summary => JSON.stringify(summary)));
  }

  return summaries;
};

export function buildSummaryPage(defaultDate, summaries) {
  const summaryRows = summaries.map(summary => `
    <tr>
      <td class="summary"><a href="/v1/summaries/${summary.id}">${summary.title}</a></td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BIS Community Summaries</title>
    <style>
        body {
            font-family: Poppins, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #250083, #a238FF);
            background-attachment: fixed;
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #AAE9FF;
            color: black;
        }
        a {
          color: white;
        }
        .btn {
            padding: 10px 15px;
            background-color: #AAE9FF;
            color: black;
            border: none;
            cursor: pointer;
            border-radius: 10px;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
        }
        .modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 500px;
        }
        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        .close:hover {
            color: #000;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
        }
        .form-group input {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
        }
        .summary {
          text-transform: capitalize;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Community Summary List</h1>
            <button id="newSummaryBtn" class="btn">+ New Summary</button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody id="summaryTableBody">
                ${summaryRows}
            </tbody>
        </table>
    </div>

    <div id="newSummaryModal" class="modal">
        <div class="modal-content">
            <span class="close">&times;
            <h2>Create new summary</h2>
            <p><i>This will start an async task. You will get an email when it completes</i></p>
            <form id="newSummaryForm">
                <div class="form-group">
                    <label for="date">Start summary from date</label>
                    <input type="datetime-local" id="date" name="date" value="${defaultDate}" required>
                </div>
                <div class="form-group">
                    <label for="email">Send results To (email)</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="cc">Also send results to</label>
                    <input type="text" id="cc" name="cc">
                </div>
                <button type="submit" class="btn">Start</button>
            </form>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const modal = document.getElementById('newSummaryModal');
            const btn = document.getElementById('newSummaryBtn');
            const span = document.getElementsByClassName('close')[0];

            btn.onclick = function() {
                modal.style.display = "block";
            }

            span.onclick = function() {
                modal.style.display = "none";
            }

            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = "none";
                }
            }

            document.getElementById('newSummaryForm').onsubmit = function(e) {
                e.preventDefault();
                // Here you would handle the form submission
                console.log('Form submitted');
                modal.style.display = "none";
            }
        });
    </script>
</body>
</html>
  `;
}
