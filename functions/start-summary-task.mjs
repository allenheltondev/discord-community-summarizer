import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const sfn = new SFNClient();

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const caller = event.requestContext?.http?.sourceIp;
    const input = {
      mode: 'on demand',
      metadata: {
        to: body.email,
        cc: body.cc ?? [],
        fromDate: new Date(body.fromDate).toISOString(),
        ...caller && { caller }
      },
      channelNames: ['security', 'event-driven', 'compute', 'data', 'programming-languages', 'observability', 'api', 'iac-tooling', 'cicd', 'finops', 'general', 'intros']
    };

    const task = await sfn.send(new StartExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN,
      input: JSON.stringify(input)
    }));
    const id = task.executionArn.split(':').pop();

    return {
      statusCode: 202,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ id })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Something went wrong' })
    };
  }

};
