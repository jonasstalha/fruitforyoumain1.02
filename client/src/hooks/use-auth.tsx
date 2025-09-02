import { createContext, useContext, useEffect, useState } from "react";
import { 
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

export type UserRole = 'admin' | 'quality' | 'logistics' | 'reception' | 'production' | 'personnel' | 'comptabilite';

interface CustomUser extends User {
  role?: UserRole;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasAccess: (section: string) => boolean;
}

// Role permissions mapping
const rolePermissions: Record<UserRole, string[]> = {
  admin: ['menu', 'admin', 'logistics', 'quality', 'reception', 'production', 'personnel', 'Comptabilité'],
  quality: ['menu', 'quality'],
  logistics: ['menu', 'logistics'],
  reception: ['menu', 'reception'],
  production: ['menu', 'production'],
  personnel: ['menu', 'personnel'],
  comptabilite: ['menu', 'Comptabilité'],
};

// Demo role mapping based on email
const getRoleFromEmail = (email: string): UserRole => {
  if (email.includes('admin')) return 'admin';
  if (email.includes('quality')) return 'quality';
  if (email.includes('logistics')) return 'logistics';
  if (email.includes('reception')) return 'reception';
  if (email.includes('production')) return 'production';
  if (email.includes('personnel')) return 'personnel';
  if (email.includes('comptabilite')) return 'comptabilite';
  if (email.includes('maintenance')) return 'maintenance';
  return 'admin'; // Default to admin
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const customUser: CustomUser = {
          ...firebaseUser,
          role: getRoleFromEmail(firebaseUser.email || '')
        };
        setUser(customUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasAccess = (section: string): boolean => {
    if (!user || !user.role) return false;
    return rolePermissions[user.role]?.includes(section) || false;
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Check if it's a demo user first
      const demoUsers: Record<string, { email: string; role: UserRole }> = {
        "admin@example.com": { email: "admin@example.com", role: "admin" },
        "quality@example.com": { email: "quality@example.com", role: "quality" },
        "logistics@example.com": { email: "logistics@example.com", role: "logistics" },
        "reception@example.com": { email: "reception@example.com", role: "reception" },
        "production@example.com": { email: "production@example.com", role: "production" },
        "personnel@example.com": { email: "personnel@example.com", role: "personnel" },
        "comptabilite@example.com": { email: "comptabilite@example.com", role: "comptabilite" },
      };

      // Check if it's a demo user
      const isDemoUser = !!demoUsers[email];
      const passwordMatch = password === "Demo@2024!";
      
      console.log("Authentication attempt:", { email, isDemoUser, passwordMatch });
      
      if (isDemoUser && passwordMatch) {
        console.log("Demo user login successful");
        // Create a demo user object
        const demoUser: CustomUser = {
          uid: `demo-${demoUsers[email].role}`,
          email,
          displayName: `${demoUsers[email].role.charAt(0).toUpperCase() + demoUsers[email].role.slice(1)} User`,
          role: demoUsers[email].role,
          emailVerified: true,
          isAnonymous: false,
          phoneNumber: null,
          photoURL: null,
          providerId: "demo",
          metadata: {} as any,
          providerData: [],
          refreshToken: "",
          tenantId: null,
          delete: async () => {},
          getIdToken: async () => "",
          getIdTokenResult: async () => ({} as any),
          reload: async () => {},
          toJSON: () => ({}),
        };
        setUser(demoUser);
        toast.success("Connexion réussie");
        return;
      }

      console.log("Attempting Firebase authentication");
      // If not a demo user, try Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = userCredential.user;
      console.log("Firebase login successful");
      toast.success("Connexion réussie");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Erreur de connexion. Vérifiez vos identifiants.");
      toast.error("Erreur de connexion: Email ou mot de passe incorrect");
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success("Déconnexion réussie");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Erreur lors de la déconnexion");
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
