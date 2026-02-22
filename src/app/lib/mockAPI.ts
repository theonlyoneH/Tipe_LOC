import { Lead, Conversation, Message, Meeting, ContentPost } from '../store/useStore';

// Generate mock leads with vector-based ranking
export const generateMockLeads = (): Lead[] => {
  const industries = [
    'Manufacturing', 'Technology', 'Agriculture', 'Textiles', 'Electronics',
    'Automotive', 'Pharmaceuticals', 'Food & Beverage', 'Chemical', 'Machinery'
  ];
  
  const countries = [
    'United States', 'Germany', 'China', 'Japan', 'United Kingdom',
    'France', 'India', 'Brazil', 'Canada', 'Australia', 'South Korea',
    'Italy', 'Spain', 'Mexico', 'Netherlands', 'Singapore', 'UAE'
  ];

  const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

  const reasons = [
    'High vector similarity in product categories and market segments',
    'Strong intent signals from recent B2B platform activity',
    'Matching trade momentum patterns with your successful deals',
    'Complementary supply chain capabilities detected',
    'Active buyer in your target categories with budget approval',
    'Geographic expansion strategy aligns with your export markets',
    'Technology adoption curve matches your product innovation',
    'Firmographic profile mirrors your best-performing clients'
  ];

  const leads: Lead[] = [];

  for (let i = 0; i < 50; i++) {
    const vectorScore = Math.random() * 0.3 + 0.7; // 0.7 - 1.0
    const intentScore = Math.random() * 0.4 + 0.6; // 0.6 - 1.0
    const tradeMomentumIndex = Math.random() * 0.35 + 0.65; // 0.65 - 1.0
    const matchPercentage = Math.round((vectorScore + intentScore + tradeMomentumIndex) / 3 * 100);
    
    leads.push({
      id: `lead-${i + 1}`,
      company_name: `${['Global', 'Prime', 'Elite', 'Apex', 'Summit', 'Peak', 'Nova', 'Stellar'][i % 8]} ${industries[i % industries.length]} Co.`,
      industry: industries[i % industries.length],
      location: countries[i % countries.length],
      vector_score: parseFloat(vectorScore.toFixed(3)),
      intent_score: parseFloat(intentScore.toFixed(3)),
      trade_momentum_index: parseFloat(tradeMomentumIndex.toFixed(3)),
      match_percentage: matchPercentage,
      firmographics_hash: `SHA256:${Math.random().toString(36).substring(2, 15)}...`,
      trust_verified: Math.random() > 0.4,
      company_size: companySizes[Math.floor(Math.random() * companySizes.length)],
      estimated_value: `$${Math.floor(Math.random() * 500 + 50)}K`,
      ai_reasoning: reasons[Math.floor(Math.random() * reasons.length)],
      outreach_template: `Personalized outreach based on ${industries[i % industries.length]} expertise`,
      status: 'pending',
      contact_person: `${['John', 'Sarah', 'Michael', 'Emily', 'David', 'Lisa'][i % 6]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][i % 5]}`,
      email: `contact${i + 1}@example.com`,
      phone: `+1-555-${String(Math.floor(Math.random() * 9000 + 1000))}`
    });
  }

  // Sort by combined ranking score
  return leads.sort((a, b) => {
    const scoreA = (a.vector_score + a.intent_score + a.trade_momentum_index) / 3;
    const scoreB = (b.vector_score + b.intent_score + b.trade_momentum_index) / 3;
    return scoreB - scoreA;
  });
};

export const generateMockConversations = (): Conversation[] => {
  const channels: Conversation['channel'][] = ['email', 'linkedin', 'whatsapp', 'call'];
  
  return [
    {
      id: 'conv-1',
      leadId: 'lead-1',
      leadName: 'Sarah Johnson',
      leadCompany: 'Global Manufacturing Co.',
      channel: 'linkedin',
      lastMessage: 'Thanks for reaching out! I\'d love to discuss this opportunity.',
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
      unreadCount: 2,
      aiHandling: true,
      status: 'active'
    },
    {
      id: 'conv-2',
      leadId: 'lead-2',
      leadName: 'Michael Chen',
      leadCompany: 'Prime Technology Co.',
      channel: 'email',
      lastMessage: 'Can you send me more details about your product specifications?',
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 120),
      unreadCount: 0,
      aiHandling: true,
      status: 'active'
    },
    {
      id: 'conv-3',
      leadId: 'lead-3',
      leadName: 'Emily Rodriguez',
      leadCompany: 'Elite Agriculture Co.',
      channel: 'whatsapp',
      lastMessage: 'I\'m interested in scheduling a demo next week',
      lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
      unreadCount: 1,
      aiHandling: false,
      status: 'active'
    }
  ];
};

export const generateMockMessages = (): Record<string, Message[]> => {
  return {
    'conv-1': [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        sender: 'user',
        content: 'Hi Sarah, I noticed your company is looking to expand into sustainable materials. We have solutions that might interest you.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        channel: 'linkedin'
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        sender: 'lead',
        content: 'Thanks for reaching out! I\'d love to discuss this opportunity.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        channel: 'linkedin'
      },
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        sender: 'ai',
        content: 'Great! I\'ve prepared a customized overview of our solutions. Would next Tuesday at 2 PM work for a quick call?',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        channel: 'linkedin'
      }
    ],
    'conv-2': [
      {
        id: 'msg-4',
        conversationId: 'conv-2',
        sender: 'user',
        content: 'Hello Michael, your recent technology investments align perfectly with our AI-powered export platform.',
        timestamp: new Date(Date.now() - 1000 * 60 * 180),
        channel: 'email'
      },
      {
        id: 'msg-5',
        conversationId: 'conv-2',
        sender: 'lead',
        content: 'Can you send me more details about your product specifications?',
        timestamp: new Date(Date.now() - 1000 * 60 * 120),
        channel: 'email'
      }
    ],
    'conv-3': [
      {
        id: 'msg-6',
        conversationId: 'conv-3',
        sender: 'ai',
        content: 'Hi Emily! I see you\'re interested in optimizing your agriculture supply chain.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
        channel: 'whatsapp'
      },
      {
        id: 'msg-7',
        conversationId: 'conv-3',
        sender: 'lead',
        content: 'I\'m interested in scheduling a demo next week',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        channel: 'whatsapp'
      }
    ]
  };
};

export const generateMockMeetings = (): Meeting[] => {
  return [
    {
      id: 'meeting-1',
      leadId: 'lead-1',
      leadName: 'Sarah Johnson',
      leadCompany: 'Global Manufacturing Co.',
      title: 'Product Demo & Discovery Call',
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      duration: 30,
      status: 'scheduled',
      meetingLink: 'https://meet.tipe.ai/demo-abc123'
    },
    {
      id: 'meeting-2',
      leadId: 'lead-4',
      leadName: 'David Brown',
      leadCompany: 'Apex Textiles Co.',
      title: 'Partnership Discussion',
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      duration: 45,
      status: 'scheduled',
      meetingLink: 'https://meet.tipe.ai/partner-xyz789'
    },
    {
      id: 'meeting-3',
      leadId: 'lead-2',
      leadName: 'Michael Chen',
      leadCompany: 'Prime Technology Co.',
      title: 'Technical Integration Review',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      duration: 60,
      status: 'completed',
      aiSummary: 'Discussed API integration requirements. Michael is interested in Q2 implementation. Follow-up with technical specs needed.',
      followUpSent: true
    }
  ];
};

export const generateMockContentPosts = (): ContentPost[] => {
  return [
    {
      id: 'post-1',
      content: '🌍 Global trade is evolving. AI-powered matchmaking is connecting exporters with verified buyers faster than ever. Are you ready for the future of B2B?',
      status: 'published',
      publishedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      engagementRate: 4.2,
      likes: 234,
      comments: 18,
      shares: 45
    },
    {
      id: 'post-2',
      content: '📊 New insight: Companies using intent-driven lead matching see 3x higher conversion rates. The secret? Vector similarity + real-time trade momentum analysis.',
      status: 'scheduled',
      scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 24)
    },
    {
      id: 'post-3',
      content: 'Just closed another international deal through AI-powered matching. The future of export is intelligent, automated, and incredibly efficient. 🚀',
      status: 'draft'
    }
  ];
};

// Mock API calls
export const mockAPI = {
  getLeads: async (): Promise<Lead[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return generateMockLeads();
  },

  updateLeadStatus: async (leadId: string, status: Lead['status']): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`Lead ${leadId} status updated to ${status}`);
  },

  getConversations: async (): Promise<Conversation[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockConversations();
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const messages = generateMockMessages();
    return messages[conversationId] || [];
  },

  sendMessage: async (conversationId: string, content: string): Promise<Message> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      id: `msg-${Date.now()}`,
      conversationId,
      sender: 'user',
      content,
      timestamp: new Date(),
      channel: 'email'
    };
  },

  getMeetings: async (): Promise<Meeting[]> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    return generateMockMeetings();
  },

  getContentPosts: async (): Promise<ContentPost[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockContentPosts();
  }
};
