import React, { useState } from 'react';
import { MessageCircle, Bell, Search, Filter } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface Notification {
  id: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export default function CommunicationDashboard() {
  const [activeTab, setActiveTab] = useState('messages');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Logistics Team',
      content: 'New shipment arriving today at 14:00',
      timestamp: new Date(),
      read: false,
      priority: 'high',
    },
    {
      id: '2',
      sender: 'Quality Control',
      content: 'Daily quality report is ready for review',
      timestamp: new Date(),
      read: true,
      priority: 'medium',
    }
  ]);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'n1',
      content: 'System maintenance scheduled for tomorrow at 10:00 AM.',
      timestamp: new Date(),
      read: false,
    },
    {
      id: 'n2',
      content: 'Reminder: Submit your weekly report.',
      timestamp: new Date(),
      read: true,
    }
  ]);

  const getTabClassName = (tabName: string) => {
    return activeTab === tabName
      ? 'px-6 py-3 border-b-2 border-blue-500 text-blue-600'
      : 'px-6 py-3 text-gray-500 hover:text-gray-700';
  };

  const getMessageClassName = (message: Message) => {
    const baseClass = 'p-4 rounded-lg border';
    const readClass = message.read ? 'bg-white' : 'bg-blue-50';
    const priorityClass = 
      message.priority === 'high' ? 'border-red-200' :
      message.priority === 'medium' ? 'border-yellow-200' :
      'border-gray-200';
    
    return [baseClass, readClass, priorityClass].join(' ');
  };

  // Filtered and searched messages
  const filteredMessages = messages.filter((message) => {
    const matchesSearch =
      !searchTerm ||
      message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.sender.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority =
      filterPriority === 'all' || message.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  // Mark notification as read
  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Mark message as read
  const markMessageRead = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m))
    );
  };

  // Add message
  const addMessage = (sender: string, content: string, priority: 'high' | 'medium' | 'low') => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender,
        content,
        timestamp: new Date(),
        read: false,
        priority,
      },
    ]);
  };

  // Delete message
  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  // Add notification
  const addNotification = (content: string) => {
    setNotifications(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        content,
        timestamp: new Date(),
        read: false,
      },
    ]);
  };

  // Delete notification
  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Communication Dashboard</h1>
          <p className="text-gray-600">Manage all your team communications in one place</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <select
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={getTabClassName('messages')}
            onClick={() => setActiveTab('messages')}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span>Messages</span>
            </div>
          </button>
          <button
            className={getTabClassName('notifications')}
            onClick={() => setActiveTab('notifications')}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </div>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {activeTab === 'messages' && (
            <>
              <form
                className="flex flex-col md:flex-row gap-2 mb-4"
                onSubmit={e => {
                  e.preventDefault();
                  const form = e.target as typeof e.target & { sender: { value: string }, content: { value: string }, priority: { value: string } };
                  if (form.content.value.trim()) {
                    addMessage(form.sender.value, form.content.value, form.priority.value as any);
                    form.content.value = '';
                  }
                }}
              >
                <input name="sender" placeholder="Sender" className="border rounded px-2 py-1" defaultValue="You" required />
                <input name="content" placeholder="Type a message..." className="border rounded px-2 py-1 flex-1" required />
                <select name="priority" className="border rounded px-2 py-1">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button type="submit" className="bg-blue-500 text-white px-4 py-1 rounded">Send</button>
              </form>
              <div className="space-y-4">
                {filteredMessages.length === 0 && (
                  <div className="text-center text-gray-400">No messages found.</div>
                )}
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={getMessageClassName(message)}
                    onClick={() => markMessageRead(message.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">{message.sender}</h3>
                      <span className="text-sm text-gray-500">
                        {message.timestamp.toLocaleTimeString()}
                        {!message.read && (
                          <span className="ml-2 text-xs text-blue-500">●</span>
                        )}
                      </span>
                      <button
                        className="ml-2 text-xs text-red-500 hover:underline"
                        onClick={e => { e.stopPropagation(); deleteMessage(message.id); }}
                        title="Delete"
                      >Delete</button>
                    </div>
                    <p className="text-gray-600">{message.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <form
                className="flex flex-col md:flex-row gap-2 mb-4"
                onSubmit={e => {
                  e.preventDefault();
                  const form = e.target as typeof e.target & { content: { value: string } };
                  if (form.content.value.trim()) {
                    addNotification(form.content.value);
                    form.content.value = '';
                  }
                }}
              >
                <input name="content" placeholder="Add notification..." className="border rounded px-2 py-1 flex-1" required />
                <button type="submit" className="bg-yellow-500 text-white px-4 py-1 rounded">Add</button>
              </form>
              <div className="space-y-4">
                {notifications.length === 0 && (
                  <div className="text-center text-gray-400">No notifications.</div>
                )}
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border ${notification.read ? 'bg-white' : 'bg-yellow-50 border-yellow-200'}`}
                    onClick={() => markNotificationRead(notification.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-gray-900 font-medium">Notification</span>
                      <span className="text-sm text-gray-500">
                        {notification.timestamp.toLocaleTimeString()}
                        {!notification.read && (
                          <span className="ml-2 text-xs text-yellow-500">●</span>
                        )}
                      </span>
                      <button
                        className="ml-2 text-xs text-red-500 hover:underline"
                        onClick={e => { e.stopPropagation(); deleteNotification(notification.id); }}
                        title="Delete"
                      >Delete</button>
                    </div>
                    <p className="text-gray-600">{notification.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
