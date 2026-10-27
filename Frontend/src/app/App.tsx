
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { restoreSessionThunk, logout } from '../store/authSlice';

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch(logout());
    };

    window.addEventListener(
      'medmove:unauthorized',
      handleUnauthorized,
    );

    void dispatch(restoreSessionThunk());

    return () => {
      window.removeEventListener(
        'medmove:unauthorized',
        handleUnauthorized,
      );
    };
  }, [dispatch]);

  return <RouterProvider router={router} />;
}
