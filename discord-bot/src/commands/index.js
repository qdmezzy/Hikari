import { accountCommands, handleAccountComponent, isAccountComponent } from "./account.js";
import { handleTrackingComponent, isTrackingComponent, trackingCommands } from "./tracking.js";
import { compareCommand, discoverCommands, handleDiscoverComponent, isDiscoverComponent } from "./discover.js";
import { shareCommands } from "./share.js";
import { statsCommands } from "./stats.js";
import { adminCommands } from "./admin.js";
import { favoritesCommands } from "./favorites.js";
import { handleHelpComponent, isHelpComponent } from "../ui/helpMenu.js";

export const commands = [
  ...accountCommands,
  ...trackingCommands,
  ...discoverCommands,
  compareCommand,
  ...shareCommands,
  ...statsCommands,
  ...favoritesCommands,
  ...adminCommands,
];

export const handleComponentInteraction = async (interaction) => {
  if (isHelpComponent(interaction)) {
    return handleHelpComponent(interaction);
  }
  if (isTrackingComponent(interaction)) {
    return handleTrackingComponent(interaction);
  }
  if (isAccountComponent(interaction)) {
    return handleAccountComponent(interaction);
  }
  if (isDiscoverComponent(interaction)) {
    return handleDiscoverComponent(interaction);
  }
  return false;
};
