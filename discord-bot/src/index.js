import { Client, Collection, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { commands, handleComponentInteraction } from "./commands/index.js";
import { config } from "./config.js";
import { buildErrorEmbed } from "./lib/embeds.js";
import { startAiringBroadcast } from "./services/scheduler.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

const registerCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  if (config.discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), { body });
    console.log(`[hikari-bot] Registered ${body.length} guild commands (${config.discordGuildId}).`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discordClientId), { body });
  console.log(`[hikari-bot] Registered ${body.length} global commands.`);
};

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[hikari-bot] Ready as ${readyClient.user.tag}`);
  startAiringBroadcast(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const handled = await handleComponentInteraction(interaction);
      if (handled) return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    await command.execute(interaction);
  } catch (error) {
    if (error?.code === 10062) {
      console.warn(
        "[hikari-bot] Interaction expired or was already acknowledged (10062). Check for duplicate bot instances.",
      );
      return;
    }
    console.error("[hikari-bot] Interaction error:", error);
    const payload = {
      embeds: [buildErrorEmbed({ title: "Command Error", description: "Something went wrong while running that command." })],
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

// Keep the bot alive through transient network/API failures.
process.on("unhandledRejection", (reason) => {
  console.error("[hikari-bot] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[hikari-bot] Uncaught exception:", error);
});

const boot = async () => {
  await registerCommands();
  await client.login(config.discordToken);
};

boot().catch((error) => {
  console.error("[hikari-bot] Failed to start:", error);
  process.exit(1);
});
