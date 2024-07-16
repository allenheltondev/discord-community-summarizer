import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
const bedrock = new BedrockRuntimeClient();
const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';

export const handler = async (state) => {
  try{
    const prompt = `Below is a transcript of all the messages from the "${state.channel}" channel on my discord server. Create a <summary> section ` +
    `of high value and noteworthy insights and helpful answers in the discussion. Summarize it for podcast/newsletter consumption. Only list in markdown` +
    `bullet points, you don't need an intro to your answer. If nothing noteworthy occurred, just say "nothing noteworthy". In `+
    `a <unansweredQuestions> section, state the unanswered questions and who asked them. A question should be formatted with (username) - (question). ` +
    `Make the question not contain any new lines. Separate each question by a new line and do not bullet them.
    <transcript>
    ${state.transcript}
    </transcript>`;
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        max_tokens: 10000,
        anthropic_version: "bedrock-2023-05-31",
        messages: [
          {
            role: "user",
            content: [{
              type: "text",
              text: prompt
            }]
          }
        ]
      })
    }));

    const answer = JSON.parse(new TextDecoder().decode(response.body));
    const aiResponse = answer.content[0].text;

    const summary = parseSection('summary', aiResponse);
    const unansweredQuestions = parseSection('unansweredQuestions', aiResponse);

    return {
      channel: state.channel,
      summary,
      questions: unansweredQuestions.split('\n').filter(q => q),
      hasSummary: true
    };
  } catch(err) {
    console.error(err);
    throw err;
  }
}

const parseSection = (sectionName, content) => {
  const regex = new RegExp(`<${sectionName}>((.|\n)*)<\/${sectionName}>`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}