const crypto = require('crypto');

const channels = new Map();
const sockets = new Map();

const id = () => crypto.randomBytes(8).toString('hex');

const nickname = () => {
  const adjectives = ['Swift', 'Calm', 'Bright', 'Quiet', 'Bold', 'Keen', 'Warm', 'Lucky'];
  const animals = ['Otter', 'Heron', 'Lynx', 'Finch', 'Badger', 'Falcon', 'Marten', 'Ibex'];
  return (
    adjectives[Math.floor(Math.random() * adjectives.length)] +
    animals[Math.floor(Math.random() * animals.length)] +
    Math.floor(Math.random() * 90 + 10)
  );
};

const channelSummary = channel => ({
  _id: channel.id,
  title: channel.title,
  description: channel.description,
  members: channel.members.length,
  messages: channel.messages.length
});

const createChannel = (title, description) => {
  const trimmed = String(title || '').trim().slice(0, 40);
  if (trimmed.length < 2) return null;

  const channel = {
    id: id(),
    title: trimmed,
    description: String(description || 'No description.').slice(0, 160),
    members: [],
    messages: [],
    createdAt: Date.now()
  };

  channels.set(channel.id, channel);
  return channelSummary(channel);
};

const listChannels = () =>
  Array.from(channels.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(channelSummary);

const getChannel = channelId => channels.get(channelId) || null;

const deleteChannel = channelId => channels.delete(channelId);

const addMessage = (channelId, message) => {
  const channel = channels.get(channelId);
  if (!channel) return null;

  const record = Object.assign({ _id: id(), at: Date.now() }, message);
  channel.messages.push(record);

  if (channel.messages.length > 200) channel.messages.splice(0, channel.messages.length - 200);
  return record;
};

const messagesFor = channelId => {
  const channel = channels.get(channelId);
  return channel ? channel.messages : [];
};

const join = (channelId, member) => {
  const channel = channels.get(channelId);
  if (!channel) return false;
  if (!channel.members.includes(member)) channel.members.push(member);
  return true;
};

const leave = (channelId, member) => {
  const channel = channels.get(channelId);
  if (!channel) return;
  channel.members = channel.members.filter(entry => entry !== member);
};

const joinChannel = (channelId, member) => {
  const list = Array.from(channels.values());
  const previous = list.find(channel => channel.members.includes(member));
  if (previous && previous.id !== channelId) leave(previous.id, member);
  return join(channelId, member);
};

const onlineCount = channelId => {
  let count = 0;
  sockets.forEach(value => {
    if (value.channelId === channelId) count += 1;
  });
  return count;
};

const seed = () => {
  if (channels.size) return;
  createChannel('general', 'Anything goes.');
  createChannel('random', 'Off topic chatter.');
};

const reset = () => {
  channels.clear();
  sockets.clear();
  seed();
};

seed();

module.exports = {
  createChannel,
  listChannels,
  getChannel,
  deleteChannel,
  addMessage,
  messagesFor,
  join,
  leave,
  joinChannel,
  onlineCount,
  nickname,
  seed,
  reset,
  channels,
  sockets
};