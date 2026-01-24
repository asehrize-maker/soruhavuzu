import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { soruAPI, bransAPI } from '../services/api';
import Sorular from './Sorular';

// BranşHavuzu component simply reuses Sorular with scope="brans"
export default function BransHavuzu() {
    return <Sorular scope="brans" />;
}
