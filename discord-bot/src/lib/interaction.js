import { buildErrorEmbed, buildInfoEmbed, buildSuccessEmbed } from "./embeds.js";

const toPublicPayload = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  if ("ephemeral" in next) {
    delete next.ephemeral;
  }
  return next;
};

export const respond = async (interaction, payload) => {
  const publicPayload = toPublicPayload(payload);
  if (interaction.deferred) {
    return interaction.editReply(publicPayload);
  }
  if (interaction.replied) {
    return interaction.followUp(publicPayload);
  }
  return interaction.reply(publicPayload);
};

export const replyError = async (interaction, message, { title = "Request Failed" } = {}) =>
  respond(interaction, {
    embeds: [buildErrorEmbed({ title, description: String(message || "Something went wrong.") })],
  });

export const replySuccess = async (interaction, message, { title = "Done" } = {}) =>
  respond(interaction, {
    embeds: [buildSuccessEmbed({ title, description: String(message || "") })],
  });

export const replyInfo = async (interaction, message, { title = "Hikari" } = {}) =>
  respond(interaction, {
    embeds: [buildInfoEmbed({ title, description: String(message || "") })],
  });
