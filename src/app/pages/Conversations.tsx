import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { mockAPI } from '../lib/mockAPI';
import { motion } from 'motion/react';
import { Send, Bot, Mail, Linkedin, MessageCircle, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function Conversations() {
  const { conversations, messages, addMessage, toggleAIHandling } = useStore();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    if (conversations.length === 0) {
      mockAPI.getConversations().then((convs) => {
        convs.forEach(conv => {
          useStore.setState(state => ({
            conversations: [...state.conversations, conv]
          }));
        });
      });

      mockAPI.getMessages('conv-1').then((msgs) => {
        useStore.setState(state => ({
          messages: { ...state.messages, 'conv-1': msgs }
        }));
      });
    }
  }, [conversations.length]);

  const selectedConversation = conversations.find(c => c.id === selectedConv);
  const conversationMessages = selectedConv ? messages[selectedConv] || [] : [];

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConv) return;

    const newMessage = await mockAPI.sendMessage(selectedConv, messageInput);
    addMessage(selectedConv, newMessage);
    setMessageInput('');
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email': return 'bg-blue-100 text-blue-600';
      case 'linkedin': return 'bg-blue-700 text-white';
      case 'whatsapp': return 'bg-green-500 text-white';
      case 'call': return 'bg-purple-100 text-purple-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="h-screen flex">
      {/* Conversations List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Conversations</h2>
          <p className="text-sm text-slate-600 mt-1">{conversations.length} active</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv, index) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedConv(conv.id)}
              className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                selectedConv === conv.id ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{conv.leadName}</div>
                  <div className="text-xs text-slate-500">{conv.leadCompany}</div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getChannelColor(conv.channel)}`}>
                  {getChannelIcon(conv.channel)}
                </div>
              </div>
              <p className="text-sm text-slate-600 line-clamp-1 mb-2">{conv.lastMessage}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(conv.lastMessageTime, { addSuffix: true })}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedConversation.leadName}</h3>
                <p className="text-sm text-slate-600">{selectedConversation.leadCompany}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getChannelColor(selectedConversation.channel)}`}>
                  <div className="flex items-center gap-2">
                    {getChannelIcon(selectedConversation.channel)}
                    <span className="capitalize">{selectedConversation.channel}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleAIHandling(selectedConversation.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                    selectedConversation.aiHandling
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  {selectedConversation.aiHandling ? 'AI Active' : 'AI Inactive'}
                </button>
              </div>
            </div>

            {/* AI Banner */}
            {selectedConversation.aiHandling && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 p-4">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-sm font-semibold text-green-900">AI is handling this conversation</div>
                    <div className="text-xs text-green-700">Click "AI Active" to take manual control</div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversationMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.sender === 'lead' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-lg ${message.sender === 'lead' ? 'order-1' : 'order-2'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.sender === 'lead'
                          ? 'bg-white border border-slate-200 text-slate-900'
                          : message.sender === 'ai'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {message.sender === 'ai' && (
                        <div className="flex items-center gap-2 mb-1 text-xs opacity-90">
                          <Bot className="w-3 h-3" />
                          <span>AI Assistant</span>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 px-2">
                      {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="bg-white border-t border-slate-200 p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - AI Status */}
      {selectedConversation && (
        <div className="w-80 bg-white border-l border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">AI Status</h3>
          
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
              <div className="text-sm font-semibold text-slate-900 mb-2">Conversation Health</div>
              <div className="text-2xl font-bold text-blue-600">Excellent</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-900 mb-3">Next AI Action</div>
              <p className="text-sm text-slate-600">
                Waiting for lead response. Will follow up in 24 hours if no reply.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-900 mb-3">Sentiment Analysis</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
                </div>
                <span className="text-sm font-semibold text-green-600">85%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Positive engagement</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
