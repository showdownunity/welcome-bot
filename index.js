const {
  Client, GatewayIntentBits, PermissionFlagsBits,
  EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;

const DB_PATH = path.join(__dirname, 'welcome-data.json');
function loadDB() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ config: {} }));
  return JSON.parse(fs.readFileSync(DB_PATH));
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────
// RÈGLES OFFICIELLES
// ─────────────────────────────────────────
const RULES = `
**RÈGLEMENT OFFICIEL — APEX LEAGUE**
*Première ligue indépendante française Apex Legends*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 ARTICLE 1 — COMPORTEMENT**
› Respect obligatoire envers tous les membres, staff et partenaires.
› Toute forme de harcèlement, insulte, discrimination ou propos haineux entraîne un bannissement immédiat.
› Les provocations, trolls et comportements toxiques sont strictement interdits.
› La maturité et le fair-play sont des valeurs fondamentales de la ligue.

**🎮 ARTICLE 2 — RÈGLES DE JEU**
› Tout exploit, glitch ou bug intentionnel est interdit et sanctionné.
› La triche (logiciels tiers, aim-assist abusif, etc.) entraîne un bannissement définitif et signalement à EA.
› Les no-shows (absence non signalée à un match) sont sanctionnés par un avertissement automatique.
› Les résultats doivent être soumis dans les 30 minutes suivant la fin du match.

**⚖️ ARTICLE 3 — LITIGES ET SANCTIONS**
› Tout litige doit être ouvert via le système de tickets — aucune réclamation en dehors.
› Les décisions des arbitres sont définitives sauf appel formel via ticket dans les 24h.
› Système de sanctions progressif : avertissement → Low Priority → Blacklist temporaire → Bannissement.
› Le staff se réserve le droit de sanctionner tout comportement jugé nuisible à la ligue.

**📅 ARTICLE 4 — PARTICIPATION**
› L'inscription se fait uniquement via le site officiel de la ligue.
› Tout joueur inscrit s'engage à respecter le calendrier des matchs.
› Une absence doit être signalée au minimum 2h avant le match via ticket.
› Les forfaits répétés entraînent une exclusion temporaire de la ligue.

**💬 ARTICLE 5 — SERVEUR DISCORD**
› Les channels sont à utiliser conformément à leur description.
› La publicité non autorisée est interdite (sauf partenaires officiels).
› Le spam, les majuscules excessives et les mentions abusives sont sanctionnés.
› Toute tentative de contournement d'une sanction (compte alternatif) entraîne un bannissement définitif.

**🤝 ARTICLE 6 — FAIR-PLAY ET ESPRIT DE LA LIGUE**
› Apex League prône le fair-play, la compétition saine et le respect mutuel.
› Félicite tes adversaires — que tu gagnes ou que tu perdes.
› Tout comportement portant atteinte à l'image de la ligue sera sanctionné.
› En participant, tu acceptes de représenter dignement la communauté française Apex Legends.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*En cliquant sur "J'accepte le règlement", tu confirmes avoir lu et accepté l'intégralité de ces règles.*
*Toute violation expose à des sanctions pouvant aller jusqu'au bannissement définitif.*
`;

// ─────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────
async function setupWelcome(message) {
  const guild = message.guild;
  const db    = loadDB();
  await message.reply('⚙️ Configuration du système d\'accueil...');

  // Trouve ou crée les rôles nécessaires
  const findOrCreate = async (name, color, hoist = false) => {
    let role = guild.roles.cache.find(r => r.name === name);
    if (!role) {
      role = await guild.roles.create({ name, color, hoist, mentionable: false });
      await sleep(300);
    }
    return role;
  };

  const visiteurRole      = await findOrCreate('Visiteur',        0x95A5A6);
  const joueurVerifRole   = await findOrCreate('Joueur Vérifié',  0x2ECC71);

  // Trouve les channels règles et bienvenue
  const rulesChannel   = guild.channels.cache.find(c => c.name.includes('règles'));
  const welcomeChannel = guild.channels.cache.find(c => c.name.includes('bienvenue'));

  if (!rulesChannel) { await message.reply('❌ Channel `・règles` introuvable sur le serveur.'); return; }

  db.config = {
    visiteurRoleId:    visiteurRole.id,
    joueurVerifRoleId: joueurVerifRole.id,
    rulesChannelId:    rulesChannel.id,
    welcomeChannelId:  welcomeChannel?.id || null,
  };
  saveDB(db);

  // Poste les règles avec bouton
  await sendRulesMessage(rulesChannel);

  // Message de bienvenue dans le channel bienvenue
  if (welcomeChannel) await sendWelcomeChannelMessage(welcomeChannel, guild);

  await message.channel.send(
    `✅ **Système d'accueil configuré !**\n\n` +
    `📋 Règles postées dans ${rulesChannel}\n` +
    `👤 Rôle à l'arrivée : **Visiteur**\n` +
    `✅ Rôle après acceptation : **Joueur Vérifié**\n\n` +
    `Les nouveaux membres recevront automatiquement le rôle Visiteur et un MP de bienvenue.`
  );
}

// ─────────────────────────────────────────
// MESSAGE RÈGLES
// ─────────────────────────────────────────
async function sendRulesMessage(channel) {
  // Supprime les anciens messages du bot
  try {
    const msgs   = await channel.messages.fetch({ limit: 20 });
    const botMsg = msgs.filter(m => m.author.id === client.user.id);
    for (const m of botMsg.values()) await m.delete().catch(() => {});
  } catch {}

  const embed = new EmbedBuilder()
    .setTitle('📋 Règlement Officiel — Apex League')
    .setDescription(RULES)
    .setColor(0x5865F2)
    .setTimestamp()
    .setFooter({ text: 'Apex League — Première ligue indépendante française' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('accept_rules')
      .setLabel('✅  J\'accepte le règlement')
      .setStyle(ButtonStyle.Success),
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─────────────────────────────────────────
// MESSAGE BIENVENUE DANS LE CHANNEL
// ─────────────────────────────────────────
async function sendWelcomeChannelMessage(channel, guild) {
  try {
    const msgs   = await channel.messages.fetch({ limit: 10 });
    const botMsg = msgs.filter(m => m.author.id === client.user.id);
    for (const m of botMsg.values()) await m.delete().catch(() => {});
  } catch {}

  const rulesChannel = guild.channels.cache.find(c => c.name.includes('règles'));

  await channel.send({ embeds: [new EmbedBuilder()
    .setTitle('👋 Bienvenue sur Apex League !')
    .setDescription(
      `Bienvenue sur le serveur de la **première ligue indépendante française Apex Legends** !\n\n` +
      `**Pour accéder au serveur :**\n` +
      `> 1️⃣ Lis le règlement dans ${rulesChannel || '・règles'}\n` +
      `> 2️⃣ Clique sur **"J'accepte le règlement"**\n` +
      `> 3️⃣ Tu obtiens accès à l'ensemble du serveur !\n\n` +
      `**Pour participer à la ligue :**\n` +
      `> Inscris-toi sur le site officiel via **・site-officiel**\n\n` +
      `*Bonne chance sur les arènes ! 🎮*`
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'Apex League — Première ligue indépendante française' })] });
}

// ─────────────────────────────────────────
// NOUVEAU MEMBRE — attribue Visiteur + MP
// ─────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  const db = loadDB();
  if (!db.config.visiteurRoleId) return;

  // Attribue le rôle Visiteur
  try { await member.roles.add(db.config.visiteurRoleId); } catch {}

  // Récupère les channels
  const guild        = member.guild;
  const rulesChannel = guild.channels.cache.get(db.config.rulesChannelId);

  // MP de bienvenue
  try {
    await member.send({ embeds: [new EmbedBuilder()
      .setTitle(`👋 Bienvenue sur Apex League, ${member.user.username} !`)
      .setDescription(
        `Tu viens de rejoindre le serveur de la **première ligue indépendante française Apex Legends** !\n\n` +
        `**Pour accéder au serveur :**\n` +
        `> Lis le règlement dans ${rulesChannel || '・règles'} et clique sur **"J'accepte le règlement"**\n\n` +
        `**Pour participer à la ligue :**\n` +
        `> Inscris-toi sur le site officiel une fois que tu as accès au serveur.\n\n` +
        `À très vite sur les arènes ! 🎮\n\n` +
        `*— L'équipe Apex League*`
      )
      .setColor(0x5865F2)
      .setThumbnail('https://media.contentapi.ea.com/content/dam/apex-legends/common/apex-legends-meta-image.jpg')
      .setFooter({ text: 'Apex League — Première ligue indépendante française' })] });
  } catch {}

  // Message dans le channel bienvenue
  const welcomeCh = guild.channels.cache.get(db.config.welcomeChannelId);
  if (welcomeCh) {
    await welcomeCh.send({ embeds: [new EmbedBuilder()
      .setDescription(`👋 **${member.user.username}** vient de rejoindre Apex League ! Bienvenue ! 🎮`)
      .setColor(0x2ECC71)
      .setThumbnail(member.user.displayAvatarURL())] })
      .catch(() => {});
  }
});

// ─────────────────────────────────────────
// BOUTON — acceptation des règles
// ─────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'accept_rules') return;

  const db     = loadDB();
  const member = interaction.member;

  // Vérifie si déjà vérifié
  if (member.roles.cache.has(db.config.joueurVerifRoleId)) {
    await interaction.reply({ content: '✅ Tu as déjà accepté le règlement !', ephemeral: true });
    return;
  }

  // Attribue Joueur Vérifié + retire Visiteur
  try {
    await member.roles.add(db.config.joueurVerifRoleId);
    await member.roles.remove(db.config.visiteurRoleId).catch(() => {});
  } catch (e) {
    await interaction.reply({ content: '❌ Erreur lors de l\'attribution du rôle. Contacte un admin.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `✅ **Bienvenue dans Apex League !**\nTu as accepté le règlement et obtenu le rôle **Joueur Vérifié**. Tu as maintenant accès à l'ensemble du serveur. Bonne chance ! 🎮`,
    ephemeral: true,
  });
});


// ─────────────────────────────────────────
// SYNC PERMISSIONS
// ─────────────────────────────────────────
async function syncPermissions(guild) {
  const roles = {
    ceo:              guild.roles.cache.find(r => r.name === 'CEO'),
    directeur:        guild.roles.cache.find(r => r.name === 'Directeur'),
    responsableStaff: guild.roles.cache.find(r => r.name === 'Responsable Staff'),
    communityManager: guild.roles.cache.find(r => r.name === 'Community Manager'),
    arbitreChef:      guild.roles.cache.find(r => r.name === 'Arbitre Chef'),
    arbitre:          guild.roles.cache.find(r => r.name === 'Arbitre'),
    moderateur:       guild.roles.cache.find(r => r.name === 'Modérateur'),
    moderateurJunior: guild.roles.cache.find(r => r.name === 'Modérateur Junior'),
    ligue1:           guild.roles.cache.find(r => r.name === '— Ligue 1'),
    ligue2:           guild.roles.cache.find(r => r.name === '— Ligue 2'),
    ligue3:           guild.roles.cache.find(r => r.name === '— Ligue 3'),
    joueurVerif:      guild.roles.cache.find(r => r.name === 'Joueur Vérifié'),
    champion:         guild.roles.cache.find(r => r.name === 'Champion'),
    mvp:              guild.roles.cache.find(r => r.name === 'MVP'),
    partenaire:       guild.roles.cache.find(r => r.name === 'Partenaire'),
    streamer:         guild.roles.cache.find(r => r.name === 'Streamer Officiel'),
    visiteur:         guild.roles.cache.find(r => r.name === 'Visiteur'),
    blacklist:        guild.roles.cache.find(r => r.name === 'Blacklist'),
    lowPriority:      guild.roles.cache.find(r => r.name === 'Low Priority'),
  };

  const everyone = guild.roles.everyone;

  // Rôles staff complets
  const staffRoles    = [roles.ceo, roles.directeur, roles.responsableStaff, roles.communityManager, roles.arbitreChef, roles.arbitre, roles.moderateur, roles.moderateurJunior].filter(Boolean);
  // Rôles membres vérifiés
  const memberRoles   = [roles.joueurVerif, roles.ligue1, roles.ligue2, roles.ligue3, roles.champion, roles.mvp, roles.partenaire, roles.streamer].filter(Boolean);

  const staffPerms    = staffRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory] }));
  const memberPerms   = memberRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }));
  const readOnlyPerms = memberRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }));

  // Blacklist — aucun accès nulle part sauf règles
  const blacklistDeny = roles.blacklist ? [{ id: roles.blacklist.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [];

  let count = 0;
  const channels = Array.from(guild.channels.cache.values());

  for (const ch of channels) {
    try {
      const name = ch.name.toLowerCase();
      const type = ch.type;

      // Catégories — on skip
      if (type === 4) continue;

      // ── ACCUEIL ──────────────────────────────
      if (name.includes('bienvenue')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }
      else if (name.includes('règles')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
          ...staffPerms,
        ]);
      }
      else if (name.includes('rôles') || name.includes('roles')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
          ...staffPerms,
        ]);
      }
      else if (name.includes('annonces')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...readOnlyPerms,
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }

      // ── LIGUE ────────────────────────────────
      else if (name.includes('comment-participer') || name.includes('site-officiel') || name.includes('classement') || name.includes('calendrier') || name.includes('résultats') || name.includes('palmares') || name.includes('palmarès')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...readOnlyPerms,
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }

      // ── APEX ESPORT ──────────────────────────
      else if (name.includes('news-apex') || name.includes('news-algs') || name.includes('meta-et-tips')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...readOnlyPerms,
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }

      // ── STREAM ───────────────────────────────
      else if (name.includes('twitch') || name.includes('discord-du-caster') || name.includes('planning-des-lives') || name.includes('vod')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...readOnlyPerms,
          ...staffPerms,
          ...(roles.streamer ? [{ id: roles.streamer.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          ...blacklistDeny,
        ]);
      }

      // ── COMMUNAUTÉ ───────────────────────────
      else if (name.includes('présentation') || name.includes('général')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...staffPerms,
          ...(roles.blacklist ? [{ id: roles.blacklist.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] }] : []),
        ]);
      }
      else if (name.includes('recherche-équipiers') || name.includes('sondages') || name.includes('clips') || name.includes('giveaways')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...memberPerms,
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }

      // ── SUPPORT ──────────────────────────────
      else if (name.includes('ouvrir-un-ticket')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...memberPerms.map(p => ({ ...p, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] })),
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }
      else if (name.includes('faq') || name.includes('suggestions') || name.includes('report')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...memberPerms,
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }

      // ── PARTENAIRES ──────────────────────────
      else if (name.includes('nos-partenaires') || name.includes('annonces-partenaires')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...readOnlyPerms,
          ...staffPerms,
          ...(roles.partenaire ? [{ id: roles.partenaire.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          ...blacklistDeny,
        ]);
      }

      // ── LIGUES PRIVÉES ───────────────────────
      else if (name.includes('-l1') || name.includes('ligue1') || name.includes('ligue 1')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(roles.ligue1 ? [{ id: roles.ligue1.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }
      else if (name.includes('-l2') || name.includes('ligue2') || name.includes('ligue 2')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(roles.ligue2 ? [{ id: roles.ligue2.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }
      else if (name.includes('-l3') || name.includes('ligue3') || name.includes('ligue 3')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(roles.ligue3 ? [{ id: roles.ligue3.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }

      // ── RECRUTEMENT STAFF ────────────────────
      else if (name.includes('postuler-staff')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...memberPerms.map(p => ({ ...p, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] })),
          ...staffPerms,
          ...blacklistDeny,
        ]);
      }
      else if (name.includes('candidatures')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...staffPerms,
        ]);
      }

      // ── STAFF PRIVÉ ──────────────────────────
      else if (name.includes('staff') || name.includes('logs-') || name.includes('tickets-archivés') || name.includes('modération')) {
        await ch.permissionOverwrites.set([
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...staffPerms,
        ]);
      }

      count++;
      await sleep(300);
    } catch (e) {
      console.log(`⚠️ Erreur channel ${ch.name}: ${e.message}`);
    }
  }

  console.log(`✅ ${count} channels synchronisés.`);
}

// ─────────────────────────────────────────
// COMMANDES
// ─────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const cmd = message.content.trim().split(/\s+/)[0].toLowerCase();

  if (cmd === '!setup-welcome') {
    await setupWelcome(message);
    return;
  }

  if (cmd === '!refresh-rules') {
    const db = loadDB();
    const ch = message.guild.channels.cache.get(db.config.rulesChannelId);
    if (!ch) { await message.reply('❌ Channel règles introuvable. Lance `!setup-welcome`.'); return; }
    await sendRulesMessage(ch);
    await message.reply('✅ Règles rafraîchies !');
    return;
  }

  if (cmd === '!sync-permissions') {
    await message.reply('⚙️ Synchronisation des permissions... (1-2 minutes)');
    try {
      await syncPermissions(message.guild);
      await message.channel.send('✅ Permissions synchronisées sur tous les channels !');
    } catch (e) {
      console.error('Erreur sync:', e);
      await message.channel.send('❌ Erreur. Voir les logs Railway.');
    }
    return;
  }

  if (cmd === '!welcome-aide') {
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('Welcome Bot — Commandes')
      .setDescription(
        '`!setup-welcome` — Configure le système d\'accueil *(admin)*\n' +
        '`!refresh-rules` — Rafraîchit le message des règles *(admin)*\n' +
        '`!sync-permissions` — Synchronise les permissions de tous les channels *(admin)*\n\n' +
        '**Automatique :**\n' +
        '› Rôle **Visiteur** attribué à chaque nouveau membre\n' +
        '› MP de bienvenue envoyé automatiquement\n' +
        '› Rôle **Joueur Vérifié** attribué après acceptation des règles'
      ).setColor(0x5865F2)] });
    return;
  }
});

// ─────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`✅ Welcome Bot connecté : ${client.user.tag}`);
  console.log(`📌 !setup-welcome pour configurer l'accueil`);
});

client.login(TOKEN);
