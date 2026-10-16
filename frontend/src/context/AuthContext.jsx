import { createContext, useContext, useEffect, useState } from 'react';
import { requestApi } from '../lib/api';
import { auth } from '../lib/firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut as firebaseSignOut,
    onAuthStateChanged 
} from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const syncUserToBackend = async (firebaseUser, additionalData = {}) => {
        try {
            const token = await firebaseUser.getIdToken(true);
            localStorage.setItem('unifix_token', token);
            const res = await requestApi({
                method: 'post',
                url: '/auth/sync',
                headers: { Authorization: `Bearer ${token}` },
                data: additionalData
            });
            setUser(res.data.user);
            return res.data;
        } catch (err) {
            console.error('Failed to sync user with backend:', err);
            throw err;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const token = await firebaseUser.getIdToken();
                    localStorage.setItem('unifix_token', token);
                    const res = await requestApi({
                        method: 'get',
                        url: '/auth/me',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setUser(res.data);
                } catch (err) {
                    console.error('Auth verification failed', err);
                    setUser(null);
                    localStorage.removeItem('unifix_token');
                }
            } else {
                setUser(null);
                localStorage.removeItem('unifix_token');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email, password, systemContext = {}) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return await syncUserToBackend(userCredential.user, { systemContext });
    };

    const register = async (userData) => {
        const { email, password, name, systemContext } = userData;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return await syncUserToBackend(userCredential.user, { name, systemContext, role: 'user' });
    };

    const logout = async () => {
        await firebaseSignOut(auth);
        localStorage.removeItem('unifix_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
