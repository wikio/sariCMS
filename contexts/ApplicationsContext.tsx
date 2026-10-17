// contexts/ApplicationsContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Application {
  id: number;
  jobId: number | string;
  title: string;
  image: string;
  location: string;
  salary: string;
  type: string;
  status: 'pending' | 'reviewed' | 'interview' | 'accepted' | 'rejected';
  appliedAt: string;
  fullName: string;
  email: string;
  phone: string;
  linkedin?: string;
  yearsExp?: string;
  motivation: string;
}

interface ApplicationsContextType {
  applications: Application[];
  applicationsCount: number;
  addApplication: (appData: Omit<Application, 'id' | 'appliedAt' | 'status'>) => Application;
  removeApplication: (id: number) => void;
  hasApplied: (jobId: number | string) => boolean;
}

const ApplicationsContext = createContext<ApplicationsContextType | undefined>(undefined);

export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('sari_applications');
    if (stored) {
      try {
        setApplications(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('sari_applications');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sari_applications', JSON.stringify(applications));
  }, [applications]);

  const addApplication = (appData: Omit<Application, 'id' | 'appliedAt' | 'status'>): Application => {
    const newApp: Application = {
      ...appData,
      id: Date.now(),
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };
    setApplications((prev) => [newApp, ...prev]);
    return newApp;
  };

  const removeApplication = (id: number) => {
    setApplications((prev) => prev.filter((a) => a.id !== id));
  };

  const hasApplied = (jobId: number | string): boolean => {
    return applications.some((a) => String(a.jobId) === String(jobId));
  };

  return (
    <ApplicationsContext.Provider
      value={{
        applications,
        applicationsCount: applications.length,
        addApplication,
        removeApplication,
        hasApplied,
      }}
    >
      {children}
    </ApplicationsContext.Provider>
  );
}

export function useApplications() {
  const context = useContext(ApplicationsContext);
  if (!context) throw new Error('useApplications must be used within ApplicationsProvider');
  return context;
}