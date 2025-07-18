
"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Edit,
  Save,
  X,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = 'force-dynamic';

type AppUser = {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  createdAt: Timestamp | Date;
  lastLogin?: Timestamp | Date;
};

const editUserSchema = z.object({
  displayName: z.string().min(1, "Name is required."),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

const ProtectedUsersPage = () => {
    const [users, setUsers] = React.useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editingUser, setEditingUser] = React.useState<AppUser | null>(null);
    const { toast } = useToast();
    const { user, authStatus } = useAuth();

    const form = useForm<EditUserFormValues>({
        resolver: zodResolver(editUserSchema),
    });
    
    const fetchUsers = React.useCallback(async () => {
        if (!user) {
            console.log("Fetch users skipped: no user object.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const usersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
            
            // Sort by lastLogin descending, with fallback to createdAt for users who have never logged in
            usersData.sort((a, b) => {
                const aDate = a.lastLogin instanceof Timestamp ? a.lastLogin.toMillis() : (a.lastLogin ? new Date(a.lastLogin).getTime() : 0);
                const bDate = b.lastLogin instanceof Timestamp ? b.lastLogin.toMillis() : (b.lastLogin ? new Date(b.lastLogin).getTime() : 0);

                if (aDate !== bDate) {
                    return bDate - aDate;
                }
                
                // Fallback to createdAt if lastLogin is the same or missing
                const aCreated = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
                const bCreated = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
                return bCreated - aCreated;
            });

            setUsers(usersData);
        } catch (error) {
            console.error("[DEBUG] Error fetching users:", error);
            toast({ variant: "destructive", title: "Failed to load users", description: "Check console for details." });
        }
        setIsLoading(false);
    }, [toast, user]);

    React.useEffect(() => {
        if (authStatus === 'authenticated' && user?.email === "amulivealigarh@gmail.com") {
          fetchUsers();
        }
    }, [fetchUsers, user, authStatus]);

    const handleEdit = (user: AppUser) => {
        setEditingUser(user);
        form.reset({ displayName: user.displayName });
    };

    const cancelEdit = () => {
        setEditingUser(null);
        form.reset();
    };

    const onUpdateUser = async (data: EditUserFormValues) => {
        if (!editingUser) return;
        setIsLoading(true);
        try {
            const userDocRef = doc(db, "users", editingUser.uid);
            await updateDoc(userDocRef, { displayName: data.displayName });
            toast({ title: "User updated successfully" });
            cancelEdit();
            await fetchUsers(); // Refresh data
        } catch (error) {
            console.error("Error updating user:", error);
            toast({ variant: "destructive", title: "Failed to update user" });
        }
        setIsLoading(false);
    };

    const deleteUserAndStatements = async (uid: string) => {
        setIsLoading(true);
        try {
            // Firestore doesn't support deleting a user from the client SDK.
            // This will delete their data, but not their auth entry.
            // Proper user deletion should be handled by a backend function for security.
            
            const batch = writeBatch(db);
            
            // Delete user document
            const userDocRef = doc(db, "users", uid);
            batch.delete(userDocRef);

            // Find and delete user's statements
            const statementsQuery = query(collection(db, "savedStatements"), where("userId", "==", uid));
            const statementsSnapshot = await getDocs(statementsQuery);
            statementsSnapshot.forEach(doc => batch.delete(doc.ref));

            await batch.commit();

            toast({ title: "User data deleted", description: "User document and all associated statements have been deleted." });
            await fetchUsers();
        } catch (error) {
            console.error("Error deleting user and their data:", error);
            toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete user data." });
        }
        setIsLoading(false);
    };
    
    const formatDate = (date: Date | Timestamp | undefined): string => {
        if (!date) return 'N/A';
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        return format(d, 'PPP p');
    }

    return (
        <main className="container mx-auto px-4 py-8 md:py-12">
            <header className="mb-8">
                <div className="flex justify-between items-center">
                    <Button asChild variant="outline">
                        <Link href="/">
                            <ArrowLeft className="mr-2" /> Back to Calculator
                        </Link>
                    </Button>
                    <ThemeToggle />
                </div>
                <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary text-center mt-4">
                    User Management
                </h1>
                <p className="text-muted-foreground mt-2 text-lg text-center">
                    View, edit, and delete user accounts.
                </p>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> All Users</CardTitle>
                    <CardDescription>A list of all users registered in the system, sorted by last login.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="hidden sm:table-cell">Phone</TableHead>
                                    <TableHead className="hidden sm:table-cell">Registered</TableHead>
                                    <TableHead>Last Login</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.uid}>
                                        <TableCell>
                                            {editingUser?.uid === user.uid ? (
                                                <form onSubmit={form.handleSubmit(onUpdateUser)} className="flex items-center gap-2">
                                                    <Input {...form.register("displayName")} className="h-8" />
                                                    <Button size="icon" className="h-8 w-8" type="submit" disabled={isLoading}><Save className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                                                </form>
                                            ) : (
                                                user.displayName
                                            )}
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell className="hidden sm:table-cell">{user.phoneNumber || 'N/A'}</TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                           {formatDate(user.createdAt)}
                                        </TableCell>
                                        <TableCell>{formatDate(user.lastLogin)}</TableCell>
                                        <TableCell className="text-right">
                                             <Button size="sm" variant="outline" onClick={() => handleEdit(user)} className="mr-2" disabled={isLoading || !!editingUser}>
                                                 <Edit className="h-4 w-4" />
                                             </Button>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive" disabled={isLoading || !!editingUser}><Trash2 className="h-4 w-4"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete the user's profile and all their saved arrear statements. This action cannot be undone. Note: The user's authentication account will not be deleted.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteUserAndStatements(user.uid)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}


export default function UsersPage() {
    const { authStatus, loading, user } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (loading) return; // Wait until authentication status is resolved

        if (authStatus === 'unauthenticated') {
            router.push('/');
        } else if (authStatus === 'authenticated' && user?.email !== "amulivealigarh@gmail.com") {
            router.push('/');
        }
    }, [authStatus, user, router, loading]);

    if (loading || authStatus !== 'authenticated' || user?.email !== "amulivealigarh@gmail.com") {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return <ProtectedUsersPage />;
}
