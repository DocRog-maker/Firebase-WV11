import { initializeApp } from "firebase/app";
import { doc, getDoc, setDoc, getFirestore, getDocs, collection, query, where, addDoc, updateDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup} from "firebase/auth";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";

const firebaseConfig = {
  //Store these values in a .env file or just copy them from firebase console
  apiKey: import.meta.env.VITE_REACT_APP_API_KEY,
  authDomain: import.meta.env.VITE_REACT_APP_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_REACT_APP_DATABASE_URL,
  projectId: import.meta.env.VITE_REACT_APP_PROJECT_ID,
  storageBucket: import.meta.env.VITE_REACT_APP_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_REACT_APP_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_REACT_APP_APP_ID,
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export const createUserWithEmailAndPwd = async (email, password) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password).catch(function (error) {
    console.log('Error creating user:', error);
  });
  return user;
}

export const signInWithEmailAndPwd = async (email, password) => {
  const user = await signInWithEmailAndPassword(auth, email, password).catch(error => {
    console.error("Error signing in with password and email", error);
  });
  return user;
};

export const generateUserDocument = async (user, additionalData) => {
  if (!user) return;

  const docRef = doc(db, "users", user.uid);
  const { email, displayName, photoURL } = user;
  try {
    await setDoc(docRef, {
      displayName,
      email,
      photoURL,
      ...additionalData,
    })
    console.log(`snapshot saved `)
  } catch (error) {
    console.error('Error creating user document', error);
  }

  return getUserDocument(user.uid);
};

const getUserDocument = async uid => {
  if (!uid) return null;
  try {
    const docRef = doc(db, "users", uid);
    const userDocument = await getDoc(docRef);
    return {
      uid,
      ...userDocument.data(),
    };
  } catch (error) {
    console.error('Error fetching user', error);
  }
};

export const addDocumentToSign = async (uid, email, docRef, emails) => {
  if (!uid) return;
  const signed = false;
  const xfdf = [];
  const signedBy = [];
  const requestedTime = new Date();
  const signedTime = '';
  await addDoc(collection(db, 'documentsToSign'), {
    uid,
    email,
    docRef,
    emails,
    xfdf,
    signedBy,
    signed,
    requestedTime,
    signedTime,
  })
    .then(function (docRef) {
      console.log('Document written with ID: ', docRef.id);
    })
    .catch(function (error) {
      console.error('Error adding document: ', error);
    });
};

export const searchForDocumentToSign = async email => {
  const documentsRef = collection(db, 'documentsToSign');
  const queryAllocated = query(documentsRef, where('emails', 'array-contains', email)
    , where('signed', '==', false));
  const querySigned = query(documentsRef, where('signedBy', 'array-contains', email));
  const docIds = [];
  const docIdSigned = [];

  const querySignedSnapshot = await getDocs(querySigned).catch(function (error) {
    console.log('Error getting documents: ', error);
  });;

  querySignedSnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    const docId = doc.id;
    docIdSigned.push(docId);
  });

  const queryAllocatedSnapshot = await getDocs(queryAllocated).catch(function (error) {
    console.log('Error getting documents: ', error);
  });;

  queryAllocatedSnapshot.forEach((doc) => {
    const { docRef, email, requestedTime } = doc.data();
    const docId = doc.id;
    if (!docIdSigned.includes(docId)) {
      docIds.push({ docRef, email, requestedTime, docId });
    }
  });
  return docIds;
};

export const searchForDocumentsSigned = async email => {
  const documentsRef = collection(db, 'documentsToSign');
  const docIds = [];

  const querySigned = query(documentsRef, where('email', '==', email), where('signed', '==', true));
  const querySnapshot = await getDocs(querySigned).catch(function (error) {
    console.log('Error getting documents: ', error);
  })

  querySnapshot.forEach(function (doc) {
    const { docRef, emails, signedTime } = doc.data();
    const docId = doc.id;
    docIds.push({ docRef, emails, signedTime, docId });
  });

  return docIds;
};

export const getURL = async (docRef) => {
  return await getDownloadURL(ref(storage, docRef))
}

export const uploadBytesToDocRef = async (docRef, blob) => {
  await uploadBytes(docRef, blob).then(function (snapshot) {
    console.log('Uploaded the blob');
  });
}
export const uploadBytesToChild = async (docRef, blob) => {
  const docChildRef = ref(storage, docRef);
  await uploadBytes(docChildRef, blob).then(function (snapshot) {
    console.log('Uploaded the blob.');
  });
}

export const getDocSnap = async (docRef) => {
  return await getDoc(docRef);
}

export const getDocRef = (referenceString) => {
  const docRef = ref(storage, referenceString);
  return docRef
}
export const getDocRefSimpleQuery = (path, pathSegments) => {
  const docRef = doc(db, path, pathSegments)
  return docRef
}

export const updateDocSnap = async (docRef, data) => {
  return await updateDoc(docRef, data);
}
