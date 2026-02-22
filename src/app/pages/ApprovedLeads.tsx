import { useStore } from '../store/useStore';
import { motion } from 'motion/react';
import { Search, Mail, Phone, ExternalLink, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

const API = "http://10.120.101.22:8005";

export function ApprovedLeads() {
  const { approvedLeads, setApprovedLeads } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ Fetch approved leads from backend on mount so data stays after refresh
  useEffect(() => {
    const fetchApproved = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (!user.email) return;

        const res = await fetch(`${API}/approved-leads?user_email=${encodeURIComponent(user.email)}`);
        const data = await res.json();

        const formatted = data.map((item: any) => {
          const lead = item.lead_data || {};
          return {
            id: item.lead_id,
            company_name: lead.Buyer_ID || lead.company_name || item.lead_id,
            industry: lead.Industry || lead.industry || '',
            location: lead.Country || lead.location || '',
            country: lead.Country || '',
            revenue: lead.Revenue_Size_USD || '',
            match_percentage: 0,
            vector_score: 0,
            intent_score: 0,
            trade_momentum_index: 0,
            company_size: '',
            estimated_value: '',
            contact_person: '',
            trust_verified: false,
            status: 'approved' as const
          };
        });

        setApprovedLeads(formatted);
      } catch (err) {
        console.error("Error fetching approved leads:", err);
      }
    };

    fetchApproved();
  }, [setApprovedLeads]);

  const filteredLeads = approvedLeads.filter(lead =>
    (lead.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lead.industry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lead.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Approved Leads</h1>
          <p className="text-slate-600">{approvedLeads.length} leads approved and ready for outreach</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by company, industry, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Leads Grid */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-slate-400 text-lg">No approved leads yet. Start reviewing leads!</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredLeads.map((lead, index) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all hover:-translate-y-1"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-900">{lead.company_name}</h3>
                    {lead.trust_verified && (
                      <Shield className="w-5 h-5 text-green-500 fill-green-100" />
                    )}
                  </div>
                  <p className="text-slate-600">{lead.industry}{lead.location ? ` • ${lead.location}` : ''}</p>
                </div>
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-xl">
                  <div className="text-sm font-semibold">Approved</div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4 text-sm">
                {lead.country && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Country:</span>
                    <span className="font-semibold text-slate-900">{lead.country}</span>
                  </div>
                )}
                {lead.revenue && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Revenue:</span>
                    <span className="font-semibold text-slate-900">{lead.revenue}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Mail className="w-4 h-4" />
                  Email
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors">
                  <Phone className="w-4 h-4" />
                  Call
                </button>
                <button className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
