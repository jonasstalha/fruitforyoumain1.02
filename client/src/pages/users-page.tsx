import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, User, Loader2, Edit, Trash2, RefreshCw, Eye } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, updateDoc, query, where, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { toast } from "react-hot-toast";

const db = getFirestore();

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string(),
  fullName: z.string().min(2, "Le nom complet est requis"),
  role: z.enum(["admin",
    "operator",
    "client",
    "logistique",
    "quality",
    "comptability",
    "support",
    "production",
    "reception",]),
}).refine((data) => {
  return data.password === data.confirmPassword;
}, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Schema for editing existing users (no password required)
const editUserSchema = z.object({
  email: z.string().email("Email invalide"),
  fullName: z.string().min(2, "Le nom complet est requis"),
  role: z.enum(["admin",
    "operator",
    "client",
    "logistique",
    "quality",
    "comptability",
    "support",
    "production",
    "reception",]),
});

type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: Date;
  uid?: string;
};

export default function UsersPage() {
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const addUserForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      role: "operator",
    },
  });

  const editUserForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: "",
      fullName: "",
      role: "operator",
    },
  });
  
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      console.log("Starting to fetch users...");
      
      // Check if we're authenticated
      const currentUser = auth.currentUser;
      console.log("Current user:", currentUser?.email);
      
      if (!currentUser) {
        toast.error("Vous devez être connecté pour voir les utilisateurs");
        return;
      }

      console.log("Getting Firestore instance...");
      const usersCollection = collection(db, "users");
      console.log("Collection reference created");
      
      const userSnapshot = await getDocs(usersCollection);
      console.log("Snapshot received, number of documents:", userSnapshot.docs.length);
      
      const usersList = userSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log("Processing document:", doc.id, data);
        return {
          id: doc.id,
          email: data.email,
          fullName: data.fullName || data.displayName || "Nouvel utilisateur",
          role: data.role || "operator",
          createdAt: data.createdAt?.toDate() || new Date(),
          uid: data.uid || doc.id
        };
      });
      
      console.log("Final users list:", usersList);
      setUsers(usersList);
      setFilteredUsers(usersList);
      toast.success(`${usersList.length} utilisateurs chargés`);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Impossible de récupérer la liste des utilisateurs");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUsers = async () => {
    setIsRefreshing(true);
    await fetchUsers();
    setIsRefreshing(false);
  };
  
  const checkUsers = async () => {
    try {
      console.log("Checking Firebase Auth users...");
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("No authenticated user");
        return;
      }

      // Get Firestore users
      const usersCollection = collection(db, "users");
      const userSnapshot = await getDocs(usersCollection);
      console.log("Firestore users:", userSnapshot.docs.length);
      userSnapshot.docs.forEach(doc => {
        console.log("Firestore user:", doc.id, doc.data());
      });

      // Get Firebase Auth users (this will only show the current user)
      console.log("Current Firebase Auth user:", {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName
      });

    } catch (error) {
      console.error("Error checking users:", error);
    }
  };
  
  useEffect(() => {
    fetchUsers();
    checkUsers();
  }, []);

  // Filter users based on search term and role
  useEffect(() => {
    let filtered = users;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by role
    if (selectedRole !== "all") {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, selectedRole]);
  
  const onAddUserSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      setIsSubmitting(true);
      console.log("Starting user creation with values:", values);
      
      // Ensure password is provided for new users
      if (!values.password) {
        toast.error("Le mot de passe est requis pour créer un nouvel utilisateur");
        return;
      }
      
      // First try to create the user in Firebase Auth
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          values.email,
          values.password
        );
        console.log("Successfully created user in Firebase Auth:", userCredential.user.uid);
        
        // If successful, create Firestore document
        const userId = userCredential.user.uid;
        const userDoc = doc(db, "users", userId);
        
        await setDoc(userDoc, {
          email: values.email,
          fullName: values.fullName,
          role: values.role,
          uid: userId,
          createdAt: new Date(),
          displayName: values.fullName,
        });
        console.log("Successfully created Firestore document");
        
        toast.success("L'utilisateur a été créé avec succès");
        addUserForm.reset();
        setOpenAddDialog(false);
        fetchUsers();
      } catch (authError: any) {
        console.error("Firebase Auth Error:", authError);
        console.error("Error code:", authError.code);
        console.error("Error message:", authError.message);
        
        if (authError.code === 'auth/email-already-in-use') {
          toast.error("Cette adresse email est déjà utilisée dans Firebase Authentication");
        } else if (authError.code === 'auth/weak-password') {
          toast.error("Le mot de passe est trop faible");
        } else if (authError.code === 'auth/invalid-email') {
          toast.error("L'adresse email n'est pas valide");
        } else {
          toast.error(`Erreur d'authentification: ${authError.message}`);
        }
      }
    } catch (error: any) {
      console.error("General error:", error);
      toast.error("Une erreur inattendue est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const deleteUser = async (userId: string, userEmail: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userEmail} ?`)) {
      try {
        setIsSubmitting(true);
        await deleteDoc(doc(db, "users", userId));
        toast.success("L'utilisateur a été supprimé avec succès");
        await fetchUsers(); // Refresh the list
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error("Une erreur est survenue lors de la suppression de l'utilisateur");
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  const getUserRoleDisplay = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "operator":
        return "Opérateur";
      case "client":
        return "Client";
      case "logistique":
        return "Logistique";
      case "quality":
        return "Qualité";
      case "comptability":  
        return "Comptabilité";
      case "support":
        return "Support";
      case "production":
        return "Production";
      case "reception":
        return "Réception";
      default:
        return role;
    }
  };
  
  const getUserRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "operator":
        return "bg-blue-100 text-blue-800";
      case "client":
        return "bg-yellow-100 text-yellow-800";
      case "logistique":
        return "bg-green-100 text-green-800";
      case "quality":
        return "bg-red-100 text-red-800";
      case "comptability":
        return "bg-orange-100 text-orange-800";
      case "support":
        return "bg-teal-100 text-teal-800";
      case "production":
        return "bg-pink-100 text-pink-800";
      case "reception":
        return "bg-indigo-100 text-indigo-800";
        default:
        return "bg-gray-100 text-gray-800";

    }
  };
  
  // Add update user function
  const updateUser = async (userId: string, userData: Partial<User>) => {
    try {
      setIsSubmitting(true);
      await updateDoc(doc(db, "users", userId), {
        ...userData,
        updatedAt: new Date(),
      });
      toast.success("Utilisateur mis à jour avec succès");
      await fetchUsers(); // Refresh the list
      setOpenEditDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Erreur lors de la mise à jour de l'utilisateur");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditUserSubmit = async (values: z.infer<typeof editUserSchema>) => {
    if (!selectedUser) return;
    
    await updateUser(selectedUser.id, {
      email: values.email,
      fullName: values.fullName,
      role: values.role,
    });
  };

  const openEditUserDialog = (user: User) => {
    setSelectedUser(user);
    editUserForm.reset({
      email: user.email,
      fullName: user.fullName,
      role: user.role as any,
    });
    setOpenEditDialog(true);
  };

  const openViewUserDialog = (user: User) => {
    setSelectedUser(user);
    setOpenViewDialog(true);
  };
  
  // Bootstrap current user as admin if no users exist
  const bootstrapCurrentUser = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Check if current user already exists in Firestore
      const userDoc = doc(db, "users", currentUser.uid);
      const userSnapshot = await getDoc(userDoc);
      
      if (!userSnapshot.exists()) {
        // Create the current user as admin
        await setDoc(userDoc, {
          email: currentUser.email,
          fullName: currentUser.displayName || "Administrateur",
          role: "admin",
          uid: currentUser.uid,
          createdAt: new Date(),
          displayName: currentUser.displayName || "Administrateur",
        });
        
        toast.success("Utilisateur administrateur créé avec succès");
        await fetchUsers();
      } else {
        toast.info("Cet utilisateur existe déjà dans la base de données");
      }
    } catch (error) {
      console.error("Error bootstrapping user:", error);
      toast.error("Erreur lors de la création de l'utilisateur administrateur");
    }
  };

  // Add this function after fetchUsers
  const syncFirebaseUsers = async () => {
    try {
      setIsLoading(true);
      // Get current user's ID token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error("Vous devez être connecté");
        return;
      }

      const idToken = await currentUser.getIdToken();
      
      // Make request to Firebase Admin API
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyC0bMWINNGLLS6bfnK-hfRQwHFnBSJqMhI`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: idToken
        })
      });

      const data = await response.json();
      
      if (data.users) {
        // For each Firebase Auth user, create or update Firestore document
        for (const user of data.users) {
          const userDoc = doc(db, "users", user.localId);
          await setDoc(userDoc, {
            email: user.email,
            fullName: user.displayName || "Nouvel utilisateur",
            role: "operator", // Default role
            uid: user.localId,
            createdAt: new Date(parseInt(user.createdAt))
          }, { merge: true });
        }
        
        toast.success("Utilisateurs synchronisés avec succès");
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error("Error syncing users:", error);
      toast.error("Erreur lors de la synchronisation des utilisateurs");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Utilisateurs</h2>
        <div className="flex gap-2">
          <Button 
            onClick={refreshUsers} 
            variant="outline" 
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={bootstrapCurrentUser} variant="outline">
            Créer Admin Initial
          </Button>
          <Button onClick={syncFirebaseUsers} variant="outline">
            Synchroniser les utilisateurs
          </Button>
          <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un utilisateur</DialogTitle>
                <DialogDescription>
                  Créez un nouveau compte utilisateur avec un email et un mot de passe.
                </DialogDescription>
              </DialogHeader>
              <Form {...addUserForm}>
                <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4">
                  <FormField
                    control={addUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Entrez l'email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addUserForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet</FormLabel>
                        <FormControl>
                          <Input placeholder="Entrez le nom complet" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Entrez le mot de passe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addUserForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmer le mot de passe</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirmez le mot de passe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addUserForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rôle</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrateur</SelectItem>
                            <SelectItem value="operator">Opérateur</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="logistique">Logistique</SelectItem>
                            <SelectItem value="quality">Qualité</SelectItem>
                            <SelectItem value="comptability">Comptabilité</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="reception">Réception</SelectItem>
                            
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Créer
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'utilisateur sélectionné.
            </DialogDescription>
          </DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4">
              <FormField
                control={editUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Entrez l'email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editUserForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input placeholder="Entrez le nom complet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un rôle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="operator">Opérateur</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="logistique">Logistique</SelectItem>
                        <SelectItem value="quality">Qualité</SelectItem>
                        <SelectItem value="comptability">Comptabilité</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="reception">Réception</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenEditDialog(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={openViewDialog} onOpenChange={setOpenViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails de l'utilisateur</DialogTitle>
            <DialogDescription>
              Consultez les informations détaillées de l'utilisateur.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Nom complet</label>
                  <p className="text-sm">{selectedUser.fullName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Rôle</label>
                  <p className="text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUserRoleBadgeClass(selectedUser.role)}`}>
                      {getUserRoleDisplay(selectedUser.role)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date de création</label>
                  <p className="text-sm">{selectedUser.createdAt.toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ID utilisateur</label>
                  <p className="text-sm text-gray-400 font-mono">{selectedUser.uid}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenViewDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Liste des utilisateurs</CardTitle>
            <span className="text-sm text-muted-foreground">
              {filteredUsers.length} sur {users.length} utilisateurs
            </span>
          </div>
          {/* Search and Filter Controls */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="operator">Opérateur</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="logistique">Logistique</SelectItem>
                <SelectItem value="quality">Qualité</SelectItem>
                <SelectItem value="comptability">Comptabilité</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="reception">Réception</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      {users.length === 0 ? "Aucun utilisateur trouvé" : "Aucun utilisateur ne correspond aux critères de recherche"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUserRoleBadgeClass(user.role)}`}>
                          {getUserRoleDisplay(user.role)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => openViewUserDialog(user)}
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => openEditUserDialog(user)}
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => deleteUser(user.id, user.email)}
                            disabled={isSubmitting}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}