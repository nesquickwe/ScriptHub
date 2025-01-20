require('dotenv').config();
const { Client, Events, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const SCRIPTS_FILE = path.join(__dirname, 'scripts.json');

// Function to read scripts from file
async function readScripts() {
  try {
    const data = await fs.readFile(SCRIPTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      await fs.writeFile(SCRIPTS_FILE, JSON.stringify([]));
      return [];
    }
    throw error;
  }
}

// Function to write scripts to file
async function writeScripts(scripts) {
  await fs.writeFile(SCRIPTS_FILE, JSON.stringify(scripts, null, 2));
}

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ] 
});

// Command definitions
const commands = [
  new SlashCommandBuilder()
    .setName('listscripts')
    .setDescription('List all available scripts'),
  
  new SlashCommandBuilder()
    .setName('getscript')
    .setDescription('Get a specific script by name')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('The name of the script')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Get basic information about the bot')
];

// Update the refreshCommands function
async function refreshCommands() {
  try {
    console.log('Started refreshing application (/) commands.');
    
    const rest = client.rest;
    const GUILD_ID = '1201092010887618580'; // Add your server/guild ID here
    
    if (!client.user) {
      throw new Error('Client user is not ready');
    }

    // First, delete all existing commands
    const existingCommands = await rest.get(
      `/applications/${client.user.id}/guilds/${GUILD_ID}/commands`
    );
    
    console.log('Existing commands:', existingCommands);
    
    // Delete each existing command
    for (const command of existingCommands) {
      await rest.delete(
        `/applications/${client.user.id}/guilds/${GUILD_ID}/commands/${command.id}`
      );
      console.log(`Deleted command: ${command.name}`);
    }

    // Then register new commands
    const result = await rest.put(
      `/applications/${client.user.id}/guilds/${GUILD_ID}/commands`,
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands:', result);
  } catch (error) {
    console.error('Error refreshing commands:', error);
    // Log more detailed error information
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
  }
}

// Handle commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'listscripts') {
    const scripts = await readScripts();
    
    const embed = new EmbedBuilder()
      .setTitle('Available Scripts')
      .setColor(0x0099FF)
      .setDescription(scripts.length === 0 ? 'No scripts found' : 
        scripts.map(script => `• ${script.name}`).join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'getscript') {
    const scriptName = interaction.options.getString('name');
    const scripts = await readScripts();
    
    const script = scripts.find(s => s.name.toLowerCase() === scriptName?.toLowerCase());
    
    if (!script) {
      await interaction.reply({
        content: `Script "${scriptName}" not found.`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(script.name)
      .setColor(0x0099FF)
      .setDescription(script.description || 'No description provided')
      .addFields(
        { name: 'Content', value: '```\n' + script.content + '\n```' },
        { name: 'Created At', value: new Date(script.createdAt).toLocaleString() },
        { name: 'Updated At', value: new Date(script.updatedAt).toLocaleString() }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'info') {
    const scripts = await readScripts();
    const embed = new EmbedBuilder()
      .setTitle('Bot Information')
      .setColor(0x0099FF)
      .setDescription('This bot helps manage and retrieve scripts.')
      .addFields(
        { name: 'Total Scripts', value: scripts.length.toString() },
        { name: 'Commands', value: '/listscripts - List all available scripts\n/getscript <name> - Get a script by name\n/info - Show bot info' }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// Create Express server to handle API requests
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// API endpoints
app.get('/api/scripts', async (req, res) => {
  try {
    const scripts = await readScripts();
    res.json(scripts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read scripts' });
  }
});

app.post('/api/scripts', async (req, res) => {
  try {
    console.log('Received new script:', req.body);
    
    if (!req.body.name || !req.body.content) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const scripts = await readScripts();
    const newScript = {
      ...req.body,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Saving script:', newScript);
    
    scripts.push(newScript);
    await writeScripts(scripts);
    
    console.log('Script saved successfully');
    res.json(newScript);
  } catch (error) {
    console.error('Error saving script:', error);
    res.status(500).json({ error: 'Failed to save script', details: error.message });
  }
});

app.put('/api/scripts/:id', async (req, res) => {
  try {
    const scripts = await readScripts();
    const updatedScript = req.body;
    const index = scripts.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
      scripts[index] = updatedScript;
      await writeScripts(scripts);
      res.json(updatedScript);
    } else {
      res.status(404).json({ error: 'Script not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update script' });
  }
});

app.delete('/api/scripts/:id', async (req, res) => {
  try {
    const scripts = await readScripts();
    const newScripts = scripts.filter(s => s.id !== req.params.id);
    await writeScripts(newScripts);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

// Add this endpoint to check current scripts
app.get('/api/debug/scripts', async (req, res) => {
  try {
    const scripts = await readScripts();
    res.json({
      count: scripts.length,
      scripts: scripts,
      filePath: SCRIPTS_FILE
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read scripts', details: error.message });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Update the ClientReady event for better debugging
client.once(Events.ClientReady, async c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  console.log('Bot application ID:', c.user.id);
  
  try {
    await refreshCommands();
    console.log('Commands have been registered successfully!');
  } catch (error) {
    console.error('Failed to refresh commands:', error);
  }
});

// Replace environment variable with direct token
const TOKEN = 'MTI5ODczMjc0Nzk1NDU4OTY5Ng.GMfY4y.Uf262JjbvmvrgOmASpMFwmJu3Hvw9Ualazd_GQ'; // Replace with your actual bot token

// Update the login to use the token directly
client.login(TOKEN);
