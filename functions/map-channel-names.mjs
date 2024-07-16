import { getDiscordClient } from "./utils/helpers.mjs";

let discord;
export const handler = async (state) => {
  try {
    discord = await getDiscordClient();
    const guild = await discord.guilds.fetch({ guild: process.env.GUILD_ID });
    const channels = await guild.channels.fetch();
    const textChannels = channels.filter(c => c.type == 0 && state.channelNames.includes(c.name)).map(c => { return { name: c.name, id: c.id }; });

    return { channels: textChannels };
  } catch (err) {
    console.error(err);
    throw err;
  }
  finally {
    discord?.destroy();
  }
};
