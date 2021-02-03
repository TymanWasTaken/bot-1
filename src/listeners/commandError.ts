import {
  FakeChannel,
  SlashCommandMessage,
} from "../../lib/extensions/slashCommandMessage";
import { FireMessage } from "../../lib/extensions/message";
import { Listener } from "../../lib/util/listener";
import { Command } from "../../lib/util/command";
import { GuildChannel } from "discord.js";
import { TextChannel } from "discord.js";
import { Scope } from "@sentry/node";
import { DMChannel } from "discord.js";

export default class CommandError extends Listener {
  constructor() {
    super("commandError", {
      emitter: "commandHandler",
      event: "commandError",
    });
  }

  async exec(
    message: FireMessage | SlashCommandMessage,
    command: Command,
    args: any[],
    error: Error
  ) {
    try {
      await message.error();
    } catch {}

    if (typeof this.client.sentry != "undefined") {
      const sentry = this.client.sentry;
      sentry.setUser({
        id: message.author.id,
        username: `${message.author.username}#${message.author.discriminator}`,
      });
      const channel =
        message instanceof SlashCommandMessage
          ? message.realChannel
          : message.channel;
      const extras = {
        "message.id": message.id,
        "guild.id": message.guild?.id,
        "guild.name": message.guild?.name,
        "guild.shard": message.guild?.shardID || 0,
        "channel.id":
          channel instanceof FakeChannel
            ? channel.real?.id
            : channel?.id || "0",
        "channel.name":
          channel instanceof GuildChannel
            ? (channel as TextChannel).name
            : channel instanceof FakeChannel
            ? channel.real instanceof DMChannel
              ? "dm"
              : channel.real.name
            : channel?.recipient?.toString() || "Unknown",
        "command.name": command.id,
        env: process.env.NODE_ENV,
      };
      try {
        // sometimes leads to circular structure error
        extras["command.args"] = JSON.stringify(args);
      } catch {}
      sentry.setExtras(extras);
      sentry.captureException(error);
      sentry.configureScope((scope: Scope) => {
        scope.setUser(null);
        scope.setExtras(null);
      });
    }

    try {
      if (!message.author.isSuperuser()) {
        return await message.error(
          "COMMAND_ERROR_GENERIC",
          message.util?.parsed?.alias
        );
      } else {
        return await message.channel.send("```js\n" + error.stack + "```");
      }
    } catch {}
  }
}
