import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockAPI } from '../lib/mockAPI';
import { motion } from 'motion/react';
import { FileText, Plus, Calendar, TrendingUp, ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { format } from 'date-fns';

export function ContentEngine() {
  const { contentPosts, addContentPost, updateContentPost } = useStore();

  useEffect(() => {
    if (contentPosts.length === 0) {
      mockAPI.getContentPosts().then((posts) => {
        posts.forEach(post => addContentPost(post));
      });
    }
  }, [contentPosts.length, addContentPost]);

  const drafts = contentPosts.filter(p => p.status === 'draft');
  const scheduled = contentPosts.filter(p => p.status === 'scheduled');
  const published = contentPosts.filter(p => p.status === 'published');

  const aiSuggestions = [
    {
      topic: 'Trade Intelligence Trends',
      content: 'The future of global trade is data-driven. Companies leveraging AI for matchmaking see 3x faster deal closures.',
      engagement: 'High'
    },
    {
      topic: 'Export Success Story',
      content: 'How intent-driven matching helped a textile manufacturer expand to 5 new markets in 90 days.',
      engagement: 'Medium'
    },
    {
      topic: 'Vector Similarity Explained',
      content: 'Breaking down how vector embeddings transform traditional B2B matchmaking into intelligent predictions.',
      engagement: 'High'
    }
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Content Engine</h1>
          <p className="text-slate-600">AI-powered LinkedIn content automation</p>
        </div>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg">
          <Plus className="w-5 h-5" />
          Generate New Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-900">{drafts.length}</span>
          </div>
          <div className="text-sm text-slate-600">Draft Posts</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center justify-between mb-4">
            <Calendar className="w-8 h-8 text-orange-600" />
            <span className="text-2xl font-bold text-slate-900">{scheduled.length}</span>
          </div>
          <div className="text-sm text-slate-600">Scheduled</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-slate-900">{published.length}</span>
          </div>
          <div className="text-sm text-slate-600">Published</div>
        </motion.div>
      </div>

      {/* AI Suggestions */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          AI Content Suggestions
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {aiSuggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">{suggestion.topic}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  suggestion.engagement === 'High' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {suggestion.engagement}
                </span>
              </div>
              <p className="text-sm text-slate-700 mb-4 line-clamp-3">{suggestion.content}</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                Use This
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Content Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-900">Your Content</h2>
        </div>

        {/* Published Posts */}
        {published.length > 0 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Published</h3>
            {published.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-50 rounded-xl p-5 border border-slate-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-slate-700 mb-3">{post.content}</p>
                    <div className="text-xs text-slate-500">
                      Published {post.publishedDate && format(post.publishedDate, 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Published
                    </span>
                  </div>
                </div>
                
                {/* Engagement Metrics */}
                <div className="flex items-center gap-6 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-900">{post.likes}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-slate-900">{post.comments}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-semibold text-slate-900">{post.shares}</span>
                  </div>
                  <div className="ml-auto">
                    <span className="text-sm text-slate-600">
                      Engagement: <span className="font-semibold text-green-600">{post.engagementRate}%</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Scheduled Posts */}
        {scheduled.length > 0 && (
          <div className="p-6 space-y-4 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Scheduled</h3>
            {scheduled.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-50 rounded-xl p-5 border border-slate-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-slate-700 mb-3">{post.content}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      Scheduled for {post.scheduledDate && format(post.scheduledDate, 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      Scheduled
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-slate-200">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    Edit
                  </button>
                  <button className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm">
                    Cancel
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Draft Posts */}
        {drafts.length > 0 && (
          <div className="p-6 space-y-4 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Drafts</h3>
            {drafts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-50 rounded-xl p-5 border border-slate-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-slate-700">{post.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-medium">
                      Draft
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-slate-200">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    Edit & Publish
                  </button>
                  <button className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm">
                    Schedule
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
