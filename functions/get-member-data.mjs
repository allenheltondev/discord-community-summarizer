import { getDiscordClient } from "./utils/helpers.mjs";

let discord;
export const handler = async (state) => {
  try {
    discord = await getDiscordClient();
    const guild = await discord.guilds.fetch({ guild: process.env.GUILD_ID });
    await guild.members.fetch();
    const filterDate = new Date(state.filterDate);
    const members = await guild.members.cache.sort((a, b) => b.joinedAt - a.joinedAt)
      .filter(m => !m.user.bot && m.joinedAt > filterDate)
      .map(m => { return { name: m.user.displayName }; });

    const memberCount = guild.memberCount;
    const lostMemberCount = Number(state.lastMemberCount) + members.length - memberCount;
    return {
      memberCount,
      lostMemberCount,
      newMemberCount: members.length,
      newMembers: members
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
  finally {
    discord?.destroy();
  }
};
