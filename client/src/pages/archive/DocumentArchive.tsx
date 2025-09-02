import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Folder } from 'lucide-react';
import { toast } from 'sonner';

interface ArchiveBox {
  id: string;
  title: string;
  description?: string;
  userId: string;
}

export default function DocumentArchive() {
  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBoxTitle, setNewBoxTitle] = useState('');
  const [newBoxDescription, setNewBoxDescription] = useState('');

  // Load archive boxes when component mounts
  useEffect(() => {
    const loadBoxes = async () => {
      try {
        if (!auth.currentUser) {
          toast.error('Please sign in first');
          return;
        }

        const q = query(
          collection(firestore, 'archive_boxes'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('title')
        );

        const querySnapshot = await getDocs(q);
        const loadedBoxes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ArchiveBox[];

        setBoxes(loadedBoxes);
      } catch (error) {
        console.error('Error loading boxes:', error);
        toast.error('Could not load archive boxes');
      } finally {
        setLoading(false);
      }
    };

    loadBoxes();
  }, []);

  const createBox = async () => {
    try {
      if (!auth.currentUser) {
        toast.error('Please sign in first');
        return;
      }

      if (!newBoxTitle.trim()) {
        toast.error('Please enter a title');
        return;
      }

      const boxRef = await addDoc(collection(firestore, 'archive_boxes'), {
        title: newBoxTitle.trim(),
        description: newBoxDescription.trim(),
        userId: auth.currentUser.uid
      });

      setBoxes(prev => [...prev, {
        id: boxRef.id,
        title: newBoxTitle.trim(),
        description: newBoxDescription.trim(),
        userId: auth.currentUser.uid
      }]);

      setIsCreateOpen(false);
      setNewBoxTitle('');
      setNewBoxDescription('');
      toast.success('Archive box created');
    } catch (error) {
      console.error('Error creating box:', error);
      toast.error('Could not create archive box');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Document Archive</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Archive
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boxes.map((box) => (
          <Card key={box.id} className="p-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 rounded">
                <Folder className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">{box.title}</h3>
                {box.description && (
                  <p className="text-sm text-gray-500">{box.description}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Archive</DialogTitle>
            <DialogDescription>
              Create a new archive box to store your documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newBoxTitle}
                onChange={(e) => setNewBoxTitle(e.target.value)}
                placeholder="Enter title"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={newBoxDescription}
                onChange={(e) => setNewBoxDescription(e.target.value)}
                placeholder="Enter description"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createBox}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}