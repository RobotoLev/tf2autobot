import SteamID from 'steamid';
import SKU from '@tf2autobot/tf2-sku';
import pluralize from 'pluralize';
import Currencies from '@tf2autobot/tf2-currencies';
import { Listing } from '@tf2autobot/bptf-listings';
import validUrl from 'valid-url';
import sleepasync from 'sleep-async';
import dayjs from 'dayjs';
import { EFriendRelationship } from 'steam-user';
import { fixSKU } from '../functions/utils';
import Bot from '../../Bot';
import CommandParser from '../../CommandParser';
import log from '../../../lib/logger';
import { pure, testSKU } from '../../../lib/tools/export';

// Bot manager commands

type TF2GC = 'expand' | 'use' | 'delete';
type NameAvatar = 'name' | 'avatar';
type BlockUnblock = 'block' | 'unblock';

export default class ManagerCommands {
    private pricelistCount = 0;

    private executedRefreshList = false;

    private lastExecutedRefreshListTime: number | null = null;

    private executeRefreshListTimeout: NodeJS.Timeout;

    private executedRefreshSchema = false;

    private lastExecutedRefreshSchemaTime: number | null = null;

    private executeRefreshSchemaTimeout: NodeJS.Timeout;

    constructor(private readonly bot: Bot) {
        this.bot = bot;
    }

    TF2GCCommand(steamID: SteamID, message: string, command: TF2GC): void {
        const params = CommandParser.parseParams(CommandParser.removeCommand(message));

        if (command === 'expand') {
            // Expand command
            if (typeof params.craftable !== 'boolean') {
                return this.bot.sendMessage(steamID, '⚠️ Missing `craftable=true|false`');
            }

            const item = SKU.fromString('5050;6');
            if (params.craftable === false) {
                item.craftable = false;
            }

            const assetids = this.bot.inventoryManager.getInventory.findBySKU(SKU.fromObject(item), false);
            if (assetids.length === 0) {
                // No backpack expanders
                return this.bot.sendMessage(
                    steamID,
                    `❌ I couldn't find any ${!item.craftable ? 'Non-Craftable' : ''} Backpack Expander`
                );
            }

            this.bot.tf2gc.useItem(assetids[0], err => {
                if (err) {
                    log.error('Error trying to expand inventory: ', err);
                    return this.bot.sendMessage(steamID, `❌ Failed to expand inventory: ${err.message}`);
                }

                this.bot.sendMessage(steamID, `✅ Used ${!item.craftable ? 'Non-Craftable' : ''} Backpack Expander!`);
            });
        } else {
            // For use and delete commands
            if (params.sku !== undefined && !testSKU(params.sku as string)) {
                return this.bot.sendMessage(steamID, `❌ "sku" should not be empty or wrong format.`);
            }

            if (params.assetid !== undefined && params.sku === undefined) {
                const targetedAssetId = params.assetid as string;
                const sku = this.bot.inventoryManager.getInventory.findByAssetid(targetedAssetId);

                if (params.i_am_sure !== 'yes_i_am') {
                    return this.bot.sendMessage(
                        steamID,
                        `⚠️ Are you sure that you want to ${command} ${
                            sku === null
                                ? `the item with asset ID ${targetedAssetId}`
                                : `${this.bot.schema.getName(SKU.fromString(sku), false)}`
                        }?` +
                            `\n- This process is irreversible and will ${command} the item from your bot's backpack!` +
                            `\n- If you are sure, try again with i_am_sure=yes_i_am as a parameter`
                    );
                }

                return this.bot.tf2gc[command === 'use' ? 'useItem' : 'deleteItem'](targetedAssetId, err => {
                    const theItem =
                        sku === null
                            ? targetedAssetId
                            : `${this.bot.schema.getName(SKU.fromString(sku), false)} (${targetedAssetId})`;

                    if (err) {
                        log.warn(`Error trying to ${command} ${theItem}: `, err);
                        return this.bot.sendMessage(steamID, `❌ Failed to ${command} ${theItem}: ${err.message}`);
                    }

                    this.bot.sendMessage(steamID, `✅ ${command === 'use' ? 'Used' : 'Deleted'} ${theItem}!`);
                });
            }

            if (params.name !== undefined || params.item !== undefined) {
                return this.bot.sendMessage(
                    steamID,
                    command === 'use'
                        ? '⚠️ Please only use sku property.' +
                              '\n\nBelow are some common items to use:\n • ' +
                              [
                                  'Gift-Stuffed Stocking 2013: 5718;6;untradable',
                                  'Gift-Stuffed Stocking 2017: 5886;6;untradable',
                                  'Gift-Stuffed Stocking 2018: 5900;6;untradable',
                                  'Gift-Stuffed Stocking 2019: 5910;6;untradable',
                                  'Gift-Stuffed Stocking 2020: 5923;6;untradable'
                              ].join('\n• ')
                        : '⚠️ Please only use sku property.' +
                              '\n\nBelow are some common items to delete:\n • ' +
                              [
                                  'Smissmas Sweater: 16391;15;untradable;w1;pk391',
                                  'Soul Gargoyle: 5826;6;uncraftable;untradable',
                                  'Noise Maker - TF Birthday: 536;6;untradable',
                                  'Bronze Dueling Badge: 242;6;untradable',
                                  'Silver Dueling Badge: 243;6;untradable',
                                  'Gold Dueling Badge: 244;6;untradable',
                                  'Platinum Dueling Badge: 245;6;untradable',
                                  'Mercenary: 166;6;untradable',
                                  'Soldier of Fortune: 165;6;untradable',
                                  'Grizzled Veteran: 164;6;untradable',
                                  'Primeval Warrior: 170;6;untradable',
                                  'Professor Speks: 343;6;untradable',
                                  'Mann Co. Cap: 261;6;untradable',
                                  'Mann Co. Online Cap: 994;6;untradable',
                                  'Proof of Purchase: 471;6;untradable',
                                  'Mildly Disturbing Halloween Mask: 115;6;untradable',
                                  'Seal Mask: 582;6;untradable',
                                  'Pyrovision Goggles: 743;6;untradable',
                                  'Giftapult: 5083;6;untradable',
                                  'Spirit Of Giving: 655;11;untradable',
                                  'Party Hat: 537;6;untradable',
                                  'Name Tag: 5020;6;untradable',
                                  'Description Tag: 5044;6;untradable',
                                  'Ghastly Gibus: 584;6;untradable',
                                  'Ghastlier Gibus: 279;6;untradable',
                                  'Power Up Canteen: 489;6;untradable',
                                  'Bombinomicon: 583;6;untradable',
                                  'Skull Island Topper: 941;6;untradable',
                                  'Spellbook Page: 8935;6;untradable',
                                  'Gun Mettle Campaign Coin: 5809;6;untradable',
                                  'MONOCULUS!: 581;6;untradable'
                              ].join('\n• ')
                );
            }

            if (params.sku === undefined) {
                return this.bot.sendMessage(
                    steamID,
                    `⚠️ Missing sku property. Example: "!${command} sku=5923;6;untradable"`
                );
            }

            const targetedSKU = fixSKU(params.sku);
            const [uncraft, untrade] = [
                targetedSKU.includes(';uncraftable'),
                targetedSKU.includes(';untradable') || targetedSKU.includes(';untradeable')
            ];

            const item = SKU.fromString(
                targetedSKU.replace(';uncraftable', '').replace(';untradable', '').replace(';untradeable', '')
            );

            if (uncraft) {
                item.craftable = !uncraft;
            }
            if (untrade) {
                item.tradable = !untrade;
            }

            const assetids = this.bot.inventoryManager.getInventory.findBySKU(SKU.fromObject(item), false);
            const name = this.bot.schema.getName(item, false);

            if (assetids.length === 0) {
                // Item not found
                return this.bot.sendMessage(steamID, `❌ I couldn't find any ${pluralize(name, 0)}`);
            }

            let assetid: string;
            if (params.assetid !== undefined) {
                const targetedAssetId = params.assetid as string;

                if (assetids.includes(targetedAssetId)) {
                    assetid = targetedAssetId;
                } else {
                    return this.bot.sendMessage(
                        steamID,
                        `❌ Looks like an assetid ${targetedAssetId} did not match any assetids associated with ${name}` +
                            ` in my inventory. Try using the sku to use a random assetid.`
                    );
                }
            } else {
                assetid = assetids[0];
            }

            if (params.i_am_sure !== 'yes_i_am') {
                return this.bot.sendMessage(
                    steamID,
                    `/pre ⚠️ Are you sure that you want to ${command} ${name}?` +
                        `\n- This process is irreversible and will ${command} the item from your bot's backpack!` +
                        `\n- If you are sure, try again with i_am_sure=yes_i_am as a parameter`
                );
            }

            this.bot.tf2gc[command === 'use' ? 'useItem' : 'deleteItem'](assetid, err => {
                if (err) {
                    log.warn(`Error trying to ${command} ${name}: `, err);
                    return this.bot.sendMessage(
                        steamID,
                        `❌ Failed to ${command} ${name} (${assetid}): ${err.message}`
                    );
                }

                this.bot.sendMessage(steamID, `✅ ${command === 'use' ? 'Used' : 'Deleted'} ${name} (${assetid})!`);
            });
        }
    }

    nameAvatarCommand(steamID: SteamID, message: string, command: NameAvatar): void {
        const example =
            'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/f5/f57685d33224e32436f366d1acb4a1769bdfa60f_full.jpg';
        const input = CommandParser.removeCommand(message);

        if (!input || input === `!${command}`) {
            return this.bot.sendMessage(
                steamID,
                `❌ You forgot to add ${command === 'name' ? 'a name' : 'an image url'}. Example: "!${
                    command === 'name' ? 'name IdiNium' : `avatar ${example}`
                } "`
            );
        }

        if (command === 'name') {
            this.bot.community.editProfile(
                {
                    name: input
                },
                err => {
                    if (err) {
                        log.warn('Error while changing name: ', err);
                        return this.bot.sendMessage(steamID, `❌ Error while changing name: ${err.message}`);
                    }

                    this.bot.sendMessage(steamID, '✅ Successfully changed name.');
                }
            );
        } else {
            if (!validUrl.isUri(input)) {
                return this.bot.sendMessage(steamID, `❌ Your url is not valid. Example: "!avatar ${example}"`);
            }

            this.bot.community.uploadAvatar(input, err => {
                if (err) {
                    log.warn('Error while uploading new avatar: ', err);
                    return this.bot.sendMessage(steamID, `❌ Error while uploading a new avatar: ${err.message}`);
                }

                this.bot.sendMessage(steamID, '✅ Successfully uploaded a new avatar.');
            });
        }
    }

    blockedListCommand(steamID: SteamID): void {
        this.bot.community.getFriendsList((err, friendlist) => {
            if (err) {
                return this.bot.sendMessage(steamID, `❌ Error getting friendlist: ${JSON.stringify(err)}`);
            }

            const friendIDs = Object.keys(friendlist);
            if (friendIDs.length === 0) {
                return this.bot.sendMessage(steamID, `❌ I don't have any friends :sadcat:`);
            }

            const blockedFriends = friendIDs.filter(friendID =>
                [EFriendRelationship.Blocked, EFriendRelationship.Ignored, EFriendRelationship.IgnoredFriend].includes(
                    friendlist[friendID]
                )
            );

            if (blockedFriends.length === 0) {
                return this.bot.sendMessage(steamID, `❌ I don't have any blocked friends.`);
            }

            this.bot.sendMessage(
                steamID,
                // use rep.tf for shorter link - prevent Steam rate limit :(
                `Blocked friends:\n- ${blockedFriends.map(id => `https://rep.tf/${id}`).join('\n- ')}`
            );
        });
    }

    blockUnblockCommand(steamID: SteamID, message: string, command: BlockUnblock): void {
        const steamid = CommandParser.removeCommand(message);

        if (!steamid || steamid === `!${command}`) {
            return this.bot.sendMessage(
                steamID,
                `❌ You forgot to add their SteamID64. Example: "!${command} 76561198798404909"`
            );
        }

        const targetSteamID64 = new SteamID(steamid);
        if (!targetSteamID64.isValid()) {
            return this.bot.sendMessage(steamID, `❌ SteamID is not valid. Example: "!${command} 76561198798404909"`);
        }

        this.bot.client[command === 'block' ? 'blockUser' : 'unblockUser'](targetSteamID64, err => {
            if (err) {
                log.warn(`Failed to ${command} user ${targetSteamID64.getSteamID64()}: `, err);
                return this.bot.sendMessage(
                    steamID,
                    `❌ Failed to ${command} user ${targetSteamID64.getSteamID64()}: ${err.message}`
                );
            }
            this.bot.sendMessage(
                steamID,
                `✅ Successfully ${
                    command === 'block' ? 'blocked' : 'unblocked'
                } user ${targetSteamID64.getSteamID64()}`
            );
        });
    }

    async clearFriendsCommand(steamID: SteamID): Promise<void> {
        const friendsToKeep = this.bot.handler.friendsToKeep;

        let friendsToRemove: string[];
        try {
            friendsToRemove = this.bot.friends.getFriends.filter(steamid => !friendsToKeep.includes(steamid));
        } catch (err) {
            log.warn('Error while trying to remove friends:', err);

            const errStringify = JSON.stringify(err);
            const errMessage = errStringify === '' ? (err as Error)?.message : errStringify;
            return this.bot.sendMessage(steamID, `❌ Error while trying to remove friends: ${errMessage}`);
        }

        const total = friendsToRemove.length;

        if (total <= 0) {
            return this.bot.sendMessage(steamID, `❌ No friends to remove.`);
        }

        const totalTime = total * 5 * 1000;
        const aSecond = 1000;
        const aMin = 60 * 1000;
        const anHour = 60 * 60 * 1000;

        this.bot.sendMessage(
            steamID,
            `⌛ Removing ${total} friends...` +
                `\n5 seconds between each person, so it will be about ${
                    totalTime < aMin
                        ? `${Math.round(totalTime / aSecond)} seconds`
                        : totalTime < anHour
                        ? `${Math.round(totalTime / aMin)} minutes`
                        : `${Math.round(totalTime / anHour)} hours`
                } to complete.`
        );

        for (const steamid of friendsToRemove) {
            const getFriend = this.bot.friends.getFriend(steamid);

            this.bot.sendMessage(
                steamid,
                this.bot.options.customMessage.clearFriends
                    ? this.bot.options.customMessage.clearFriends.replace(
                          /%name%/g,
                          getFriend ? getFriend.player_name : steamid
                      )
                    : `/quote Hey ${
                          getFriend ? getFriend.player_name : steamid
                      }! My owner has performed friend list clearance. Please feel free to add me again if you want to trade at a later time!`
            );

            this.bot.client.removeFriend(steamid);

            // Prevent Steam from detecting the bot as spamming
            await sleepasync().Promise.sleep(5000);
        }

        this.bot.sendMessage(steamID, `✅ Friendlist clearance success! Removed ${total} friends.`);
    }

    stopCommand(steamID: SteamID): void {
        this.bot.sendMessage(steamID, '⌛ Stopping...');

        this.bot.botManager.stopProcess().catch(err => {
            log.warn('Error occurred while trying to stop: ', err);
            this.bot.sendMessage(steamID, `❌ An error occurred while trying to stop: ${(err as Error).message}`);
        });
    }

    restartCommand(steamID: SteamID): void {
        this.bot.sendMessage(steamID, '⌛ Restarting...');

        this.bot.botManager
            .restartProcess()
            .then(restarting => {
                if (!restarting) {
                    this.bot.sendMessage(
                        steamID,
                        '❌ You are not running the bot with PM2! Get a VPS and run ' +
                            'your bot with PM2: https://github.com/TF2Autobot/tf2autobot/wiki/Getting-a-VPS'
                    );
                }
            })
            .catch(err => {
                log.warn('Error occurred while trying to restart: ', err);
                this.bot.sendMessage(
                    steamID,
                    `❌ An error occurred while trying to restart: ${(err as Error).message}`
                );
            });
    }

    autokeysCommand(steamID: SteamID): void {
        const opt = this.bot.options.commands.autokeys;
        if (!opt.enable) {
            if (!this.bot.isAdmin(steamID)) {
                const custom = opt.customReply.disabled;
                return this.bot.sendMessage(steamID, custom ? custom : '❌ This command is disabled by the owner.');
            }
        }

        this.bot.sendMessage(steamID, '/pre ' + this.generateAutokeysReply(steamID, this.bot));
    }

    refreshAutokeysCommand(steamID: SteamID): void {
        if (this.bot.handler.autokeys.isEnabled === false) {
            return this.bot.sendMessage(steamID, `This feature is disabled.`);
        }

        this.bot.handler.autokeys.refresh();
        this.bot.sendMessage(steamID, '✅ Successfully refreshed Autokeys.');
    }

    refreshListingsCommand(steamID: SteamID): void {
        const opt = this.bot.options;

        if (opt.miscSettings.createListings.enable === false) {
            return this.bot.sendMessage(
                steamID,
                'miscSettings.createListings.enable is set to false, thus this command is disabled'
            );
        }

        const newExecutedTime = dayjs().valueOf();
        const timeDiff = newExecutedTime - this.lastExecutedRefreshListTime;

        if (this.executedRefreshList === true) {
            return this.bot.sendMessage(
                steamID,
                `⚠️ You need to wait ${Math.trunc(
                    ((this.pricelistCount > 4000 ? 60 : 30) * 60 * 1000 - timeDiff) / (1000 * 60)
                )} minutes before you run refresh listings command again.`
            );
        } else {
            const listings: { [sku: string]: Listing[] } = {};
            this.bot.listingManager.getListings(false, async err => {
                if (err) {
                    log.error('Unable to refresh listings: ', err);

                    const errStringify = JSON.stringify(err);
                    const errMessage = errStringify === '' ? (err as Error)?.message : errStringify;
                    return this.bot.sendMessage(
                        steamID,
                        '❌ Unable to refresh listings, please try again later: ' + errMessage
                    );
                }

                const inventoryManager = this.bot.inventoryManager;
                const inventory = inventoryManager.getInventory;
                const isFilterCantAfford = opt.pricelist.filterCantAfford.enable;

                this.bot.listingManager.listings.forEach(listing => {
                    let listingSKU = listing.getSKU();
                    if (listing.intent === 1) {
                        if (opt.normalize.painted.our && /;[p][0-9]+/.test(listingSKU)) {
                            listingSKU = listingSKU.replace(/;[p][0-9]+/, '');
                        }

                        if (opt.normalize.festivized.our && listingSKU.includes(';festive')) {
                            listingSKU = listingSKU.replace(';festive', '');
                        }

                        if (opt.normalize.strangeAsSecondQuality.our && listingSKU.includes(';strange')) {
                            listingSKU = listingSKU.replace(';strange', '');
                        }
                    } else {
                        if (/;[p][0-9]+/.test(listingSKU)) {
                            listingSKU = listingSKU.replace(/;[p][0-9]+/, '');
                        }
                    }

                    const match = this.bot.pricelist.getPrice(listingSKU);

                    if (isFilterCantAfford && listing.intent === 0 && match !== null) {
                        const canAffordToBuy = inventoryManager.isCanAffordToBuy(match.buy, inventory);

                        if (!canAffordToBuy) {
                            // Listing for buying exist but we can't afford to buy, remove.
                            log.debug(`Intent buy, removed because can't afford: ${match.sku}`);
                            listing.remove();
                        }
                    }

                    if (listing.intent === 1 && match !== null && !match.enabled) {
                        // Listings for selling exist, but the item is currently disabled, remove it.
                        log.debug(`Intent sell, removed because not selling: ${match.sku}`);
                        listing.remove();
                    }

                    listings[listingSKU] = (listings[listingSKU] ?? []).concat(listing);
                });

                const pricelist = Object.assign({}, this.bot.pricelist.getPrices);

                const keyPrice = this.bot.pricelist.getKeyPrice.metal;

                for (const sku in pricelist) {
                    if (!Object.prototype.hasOwnProperty.call(pricelist, sku)) {
                        continue;
                    }

                    const entry = pricelist[sku];
                    const _listings = listings[sku];

                    const amountCanBuy = inventoryManager.amountCanTrade(sku, true);
                    const amountAvailable = inventory.getAmount(sku, false, true);

                    if (_listings) {
                        _listings.forEach(listing => {
                            if (
                                _listings.length === 1 &&
                                listing.intent === 0 && // We only check if the only listing exist is buy order
                                entry.max > 1 &&
                                amountAvailable > 0 &&
                                amountAvailable > entry.min
                            ) {
                                // here we only check if the bot already have that item
                                log.debug(`Missing sell order listings: ${sku}`);
                            } else if (
                                listing.intent === 0 &&
                                listing.currencies.toValue(keyPrice) !== entry.buy.toValue(keyPrice)
                            ) {
                                // if intent is buy, we check if the buying price is not same
                                log.debug(`Buying price for ${sku} not updated`);
                            } else if (
                                listing.intent === 1 &&
                                listing.currencies.toValue(keyPrice) !== entry.sell.toValue(keyPrice)
                            ) {
                                // if intent is sell, we check if the selling price is not same
                                log.debug(`Selling price for ${sku} not updated`);
                            } else {
                                delete pricelist[sku];
                            }
                        });

                        continue;
                    }

                    // listing not exist

                    if (!entry.enabled) {
                        delete pricelist[sku];
                        log.debug(`${sku} disabled, skipping...`);
                        continue;
                    }

                    if (
                        (amountCanBuy > 0 && inventoryManager.isCanAffordToBuy(entry.buy, inventory)) ||
                        amountAvailable > 0
                    ) {
                        // if can amountCanBuy is more than 0 and isCanAffordToBuy is true OR amountAvailable is more than 0
                        // return this entry
                        log.debug(`Missing${isFilterCantAfford ? '/Re-adding can afford' : ' listings'}: ${sku}`);
                    } else {
                        delete pricelist[sku];
                    }
                }

                const skusToCheck = Object.keys(pricelist);
                const pricelistCount = skusToCheck.length;

                if (pricelistCount > 0) {
                    clearTimeout(this.executeRefreshListTimeout);
                    this.lastExecutedRefreshListTime = dayjs().valueOf();

                    log.debug(
                        'Checking listings for ' +
                            pluralize('item', pricelistCount, true) +
                            ` [${skusToCheck.join(', ')}] ...`
                    );

                    this.bot.sendMessage(
                        steamID,
                        'Refreshing listings for ' + pluralize('item', pricelistCount, true) + '...'
                    );

                    this.bot.handler.isRecentlyExecuteRefreshlistCommand = true;
                    this.bot.handler.setRefreshlistExecutedDelay = (this.pricelistCount > 4000 ? 60 : 30) * 60 * 1000;
                    this.pricelistCount = pricelistCount;
                    this.executedRefreshList = true;
                    this.executeRefreshListTimeout = setTimeout(() => {
                        this.lastExecutedRefreshListTime = null;
                        this.executedRefreshList = false;
                        this.bot.handler.isRecentlyExecuteRefreshlistCommand = false;
                        clearTimeout(this.executeRefreshListTimeout);
                    }, (this.pricelistCount > 4000 ? 60 : 30) * 60 * 1000);

                    await this.bot.listings.recursiveCheckPricelist(
                        skusToCheck,
                        pricelist,
                        true,
                        this.pricelistCount > 4000 ? 400 : 200,
                        true
                    );

                    log.debug('Done checking ' + pluralize('item', pricelistCount, true));
                    this.bot.sendMessage(steamID, '✅ Done refreshing ' + pluralize('item', pricelistCount, true));
                } else {
                    this.bot.sendMessage(steamID, '❌ Nothing to refresh.');
                }
            });
        }
    }

    private generateAutokeysReply(steamID: SteamID, bot: Bot): string {
        const pureNow = pure.currPure(bot);
        const currKey = pureNow.key;
        const currRef = pureNow.refTotalInScrap;

        const keyPrices = bot.pricelist.getKeyPrices;
        const isCustomPricer = bot.pricelist.isUseCustomPricer;

        const autokeys = bot.handler.autokeys;
        const userPure = autokeys.userPure;
        const status = autokeys.getOverallStatus;

        const keyBlMin = `       X`;
        const keyAbMax = `                     X`;
        const keyAtBet = `              X`;
        const keyAtMin = `         X`;
        const keyAtMax = `                   X`;
        const keysLine = `Keys ————|—————————|————▶`;
        const refBlMin = `       X`;
        const refAbMax = `                     X`;
        const refAtBet = `              X`;
        const refAtMin = `         X`;
        const refAtMax = `                   X`;
        const refsLine = `Refs ————|—————————|————▶`;
        const xAxisRef = `        min       max`;
        const keysPosition =
            currKey < userPure.minKeys
                ? keyBlMin
                : currKey > userPure.maxKeys
                ? keyAbMax
                : currKey > userPure.minKeys && currKey < userPure.maxKeys
                ? keyAtBet
                : currKey === userPure.minKeys
                ? keyAtMin
                : currKey === userPure.maxKeys
                ? keyAtMax
                : '';
        const refsPosition =
            currRef < userPure.minRefs
                ? refBlMin
                : currRef > userPure.maxRefs
                ? refAbMax
                : currRef > userPure.minRefs && currRef < userPure.maxRefs
                ? refAtBet
                : currRef === userPure.minRefs
                ? refAtMin
                : currRef === userPure.maxRefs
                ? refAtMax
                : '';
        const summary = `\n• ${userPure.minKeys} ≤ ${pluralize('key', currKey)}(${currKey}) ≤ ${
            userPure.maxKeys
        }\n• ${Currencies.toRefined(userPure.minRefs)} < ${pluralize(
            'ref',
            Currencies.toRefined(currRef)
        )}(${Currencies.toRefined(currRef)}) < ${Currencies.toRefined(userPure.maxRefs)}`;

        let reply =
            (bot.isAdmin(steamID) ? 'Your ' : 'My ') +
            `current Autokeys settings:\n${summary}\n\nDiagram:\n${keysPosition}\n${keysLine}\n${refsPosition}\n${refsLine}\n${xAxisRef}\n`;
        reply += `\n      Key prices: ${keyPrices.buy.toString()}/${keyPrices.sell.toString()} (${
            keyPrices.src === 'manual' ? 'manual' : isCustomPricer ? 'custom-pricer' : 'prices.tf'
        })`;

        const scrapAdjustmentEnabled = autokeys.isEnableScrapAdjustment;
        const scrapAdjustmentValue = autokeys.scrapAdjustmentValue;
        const keyBankingEnabled = autokeys.isKeyBankingEnabled;

        reply += `\nScrap Adjustment: ${scrapAdjustmentEnabled ? 'Enabled ✅' : 'Disabled ❌'}`;
        reply += `\n    Auto-banking: ${keyBankingEnabled ? 'Enabled ✅' : 'Disabled ❌'}`;
        reply += `\n Autokeys status: ${
            autokeys.getActiveStatus
                ? status.isBankingKeys
                    ? 'Banking' + (scrapAdjustmentEnabled ? ' (default price)' : '')
                    : status.isBuyingKeys
                    ? 'Buying for ' +
                      Currencies.toRefined(
                          keyPrices.buy.toValue() + (scrapAdjustmentEnabled ? scrapAdjustmentValue : 0)
                      ).toString() +
                      ' ref' +
                      (scrapAdjustmentEnabled ? ` (+${scrapAdjustmentValue} scrap)` : '')
                    : 'Selling for ' +
                      Currencies.toRefined(
                          keyPrices.sell.toValue() - (scrapAdjustmentEnabled ? scrapAdjustmentValue : 0)
                      ).toString() +
                      ' ref' +
                      (scrapAdjustmentEnabled ? ` (-${scrapAdjustmentValue} scrap)` : '')
                : 'Not active'
        }`;
        /*
         *        X
         * Keys ————|—————————|————▶
         *                       X
         * Refs ————|—————————|————▶
         *         min       max
         */

        return reply;
    }

    refreshSchema(steamID: SteamID): void {
        const newExecutedTime = dayjs().valueOf();
        const timeDiff = newExecutedTime - this.lastExecutedRefreshSchemaTime;

        if (this.executedRefreshSchema === true) {
            return this.bot.sendMessage(
                steamID,
                `⚠️ You need to wait ${Math.trunc(
                    (30 * 60 * 1000 - timeDiff) / (1000 * 60)
                )} minutes before you run update schema command again.`
            );
        } else {
            clearTimeout(this.executeRefreshSchemaTimeout);
            this.lastExecutedRefreshSchemaTime = dayjs().valueOf();

            this.bot.schemaManager.getSchema(err => {
                if (err) {
                    log.error('Error getting schema on !refreshSchema command:', err);
                    return this.bot.sendMessage(steamID, `❌ Error getting TF2 Schema: ${JSON.stringify(err)}`);
                }

                log.debug('Refreshing TF2 Schema...');
                this.bot.schema = this.bot.schemaManager.schema;
                this.bot.setProperties();

                this.executedRefreshSchema = true;
                this.executeRefreshSchemaTimeout = setTimeout(() => {
                    this.lastExecutedRefreshSchemaTime = null;
                    this.executedRefreshSchema = false;
                    clearTimeout(this.executeRefreshSchemaTimeout);
                }, 30 * 60 * 1000);

                this.bot.sendMessage(steamID, '✅ Refresh schema success!');
            });
        }
    }
}
