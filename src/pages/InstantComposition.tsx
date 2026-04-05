import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InstantComposition() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/expressions');
  }, [navigate]);

  return null;
}
