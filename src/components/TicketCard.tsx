'use client';


import Link from 'next/link';
import { Ticket } from '@/types';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface TicketCardProps {
  ticket: Ticket;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-white bg-red-600';
      case 'high':
        return 'text-white bg-orange-500';
      case 'medium':
        return 'text-white bg-yellow-500';
      case 'low':
        return 'text-white bg-blue-500';
      default:
        return 'text-white bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (ticket.status) {
      case 'closed':
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'open':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <Link href={`/tickets/${ticket.id}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 hover:text-blue-600">{ticket.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ml-2 ${getPriorityColor(ticket.priority)}`}>
            {ticket.priority}
          </span>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm text-gray-600 capitalize">{ticket.status}</span>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default TicketCard;
