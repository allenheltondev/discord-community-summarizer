import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getMomentoToken } from './utils/helpers.mjs';

const ddb = new DynamoDBClient();

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
      const pieces = new Date(unmarshall(lastRun.Item).date).toISOString().split(':');
      defaultDate = `${pieces[0]}:${pieces[1]}`;
    }

    const summaryPage = await buildSummaryPage(defaultDate, summaries);
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
  const response = await ddb.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: marshall({
      ':pk': 'run'
    })
  }));

  const summaries = response.Items.map(item => {
    const data = unmarshall(item);
    return {
      id: data.sk,
      date: data.runDate,
      title: `[${data.mode}] ${new Date(data.runDate).toLocaleDateString()} ${new Date(data.runDate).toLocaleTimeString()}`
    };
  }).sort((a, b) => new Date(b) - new Date(a));

  return summaries;
};

const buildSummaryPage = async (defaultDate, summaries) => {
  const momentoToken = await getMomentoToken([{ role: 'subscribeonly', cache: 'bis', topic: 'summaries' }]);
  const summaryRows = summaries.map(summary => `
    <tr>
      <td class="capitalize text-black pt-2"><a href="/v1/summaries/${summary.id}" class="hover:text-blue-600">${summary.title}</a></td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BIS Community Summaries</title>
      <link rel="icon" sizes="192x192" href="https://static.wixstatic.com/media/76993b_256de807f5014cae8b5695c220993788%7Emv2.png/v1/fill/w_192%2Ch_192%2Clg_1%2Cusm_0.66_1.00_0.01/76993b_256de807f5014cae8b5695c220993788%7Emv2.png" type="image/png">
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                purple: '#250083',
                darkBlue: '#a238FF',
                lightBlue: '#AAE9FF'
              }
            }
          }
        }
    </script>
  </head>
<body class="bg-gradient-to-br from-purple to-darkBlue text-white min-h-screen flex items-start justify-center p-6">
    <div class="max-w-4xl w-full mx-auto bg-white text-black p-6 rounded-lg shadow-lg">
        <div class="flex justify-between items-center mb-4">
            <h1 class="text-2xl font-bold">BIS Community Summary History</h1>
            <button id="newSummaryBtn" class="px-4 py-2 bg-lightBlue text-black rounded-lg font-bold">+ New Summary</button>
        </div>
        <table class="w-full border-collapse">
            <thead>
                <tr class="bg-lightBlue text-black">
                    <th class="border p-2 text-left">Date</th>
                </tr>
            </thead>
            <tbody id="summaryTableBody">
                ${summaryRows}
            </tbody>
        </table>
    </div>

    <div id="newSummaryModal" class="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style="display:none;">
        <div class="modal-content bg-white text-black p-6 rounded-lg shadow-lg w-full max-w-md">
            <span class="close cursor-pointer text-xl font-bold float-right">&times;</span>
            <h2 class="text-2xl font-semibold mb-4">Create new summary</h2>
            <p class="mb-4 italic">This will start an async task. You will get an email when it completes. And as a reminder - this costs Allen money every time you run it, so don't go crazy.</p>
            <form id="newSummaryForm">
                <div class="mb-4">
                    <label for="date" class="block mb-2">Start summary from</label>
                    <input type="datetime-local" id="date" name="date" value="${defaultDate}" class="w-full p-2 border border-gray-300 rounded" required>
                </div>
                <div class="mb-4">
                    <label for="email" class="block mb-2">Send results to (email)</label>
                    <input type="email" id="email" name="email" class="w-full p-2 border border-gray-300 rounded" required>
                </div>
                <div class="mb-4">
                    <label for="cc" class="block mb-2">Also send results to (comma separate emails)</label>
                    <input type="text" id="cc" name="cc" class="w-full p-2 border border-gray-300 rounded">
                </div>
                <button type="submit" class="px-4 py-2 bg-lightBlue text-black rounded-lg">Start</button>
            </form>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const modal = document.getElementById('newSummaryModal');
            const btn = document.getElementById('newSummaryBtn');
            const span = document.getElementsByClassName('close')[0];

            btn.onclick = function() {
                modal.style.display = "flex";
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
                const fromDate = document.getElementById('date').value;
                const email = document.getElementById('email').value;
                const cc = document.getElementById('cc').value;
                fetch('/v1/summaries', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    email,
                    fromDate,
                    ...cc && { cc: cc.split(',').map(e => e.trim())}
                  })
                })
                .then(data => {
                  subscribeForUpdates();
                })
                .catch((error) => {
                  console.error('Error:', error);
                  alert('Error starting task');
                });
                modal.style.display = "none";
            }

            async function subscribeForUpdates() {
              fetch('https://api.cache.cell-us-east-1-1.prod.a.momentohq.com/topics/bis/summaries', {
                method: 'GET',
                headers: {
                  'Authorization': '${momentoToken}',
                  'Connection': 'keep-alive'
                }
              })
              .then(response => {
                if (!response.ok) {
                  throw new Error('Network response was not ok');
                }
                return response.json();
              })
              .then(data => {
                window.location.reload();
              })
              .catch(error => {
                console.error('There was a problem subscribing for updates:', error);
              });
            }
        });
    </script>
  </body>
</html>
  `;
}

