// app/[locale]/emplois/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { 
  Briefcase, MapPin, Euro, Clock, Target, UserCheck, Award, 
  GitBranch, Gift, Star, CheckCircle, Upload, LogIn, CreditCard,
  ChevronLeft, ChevronRight, Inbox, ShoppingBag, Handshake, User,
  FileText, Mail
} from 'lucide-react';
import { getCareers } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import { useApplications } from '@/contexts/ApplicationsContext';
import type { Career } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';
import CTAButton from '@/components/ui/CTAButton';
import Badge from '@/components/shared/Badge';

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const t = useTranslations('pages.jobs');
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { addApplication, hasApplied } = useApplications();

  const [job, setJob] = useState<Career | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Career[]>([]);
  const [prevJob, setPrevJob] = useState<Career | null>(null);
  const [nextJob, setNextJob] = useState<Career | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [appFormData, setAppFormData] = useState({
    name: '', email: '', phone: '', linkedin: '', experience: '', motivation: '', cvName: '', acceptTerms: false
  });

  useEffect(() => {
    const loadJob = async () => {
      const careers = await getCareers(locale);
      const found = careers.find(j => j.id === parseInt(id));
      setJob(found || null);
      
      if (found) {
        const related = careers.filter(j => j.id !== found.id && (j.type === found.type || j.location === found.location)).slice(0, 3);
        setRelatedJobs(related);
        
        const currentIndex = careers.findIndex(j => j.id === found.id);
        setPrevJob(currentIndex > 0 ? careers[currentIndex - 1] : null);
        setNextJob(currentIndex < careers.length - 1 ? careers[currentIndex + 1] : null);
      }
    };
    loadJob();
  }, [id, locale]);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress((winScroll / height) * 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (job) {
      addApplication({
        jobId: job.id,
        title: job.title,
        image: job.image || '',
        location: job.location,
        salary: job.salary,
        type: job.type,
        fullName: appFormData.name,
        email: appFormData.email,
        phone: appFormData.phone,
        linkedin: appFormData.linkedin,
        yearsExp: appFormData.experience,
        motivation: appFormData.motivation
      });
      setApplicationSubmitted(true);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 3000);
    }
  };

  const handleQuickApply = () => {
    if (!isAuthenticated) {
      localStorage.setItem('sari_pending_action', JSON.stringify({ type: 'apply', jobId: parseInt(id) }));
      router.push(`/${locale}/connexion?source=carriere`);
      return;
    }
    if (job && hasApplied(job.id)) {
      alert(t('alreadyApplied'));
      return;
    }
    if (job) {
      addApplication({
        jobId: job.id,
        title: job.title,
        image: job.image || '',
        location: job.location,
        salary: job.salary,
        type: job.type,
        fullName: user?.name || '',
        email: user?.email || '',
        phone: '',
        motivation: ''
      });
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 3000);
    }
  };

  if (!job) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center min-h-screen flex items-center justify-center">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Briefcase className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('notFound')}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('notFoundDesc')}</p>
        <Link href={`/${locale}/carrieres`} className="btn-primary text-white px-6 py-3 inline-block rounded-lg">
          {t('backToJobs')}
        </Link>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    'CDI': 'bg-green-500', 'CDD': 'bg-blue-500', 'Stage': 'bg-purple-500',
    'Alternance': 'bg-orange-500', 'Freelance': 'bg-pink-500', 'Intérim': 'bg-yellow-500'
  };
  const typeColor = typeColors[job.type] || 'bg-sari-blue';
  const alreadyApplied = hasApplied(job.id);

  return (
    <div className="pt-32 pb-24 min-h-screen page-enter">
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 z-50">
        <div className="h-full bg-sari-blue transition-all duration-150" style={{ width: `${scrollProgress}%` }}></div>
      </div>

      {addedToCart && (
        <div className="fixed top-24 right-4 bg-green-500 text-white px-6 py-4 shadow-lg z-50 animate-fade-in-up rounded-lg flex items-center gap-3">
          <CheckCircle className="w-6 h-6" />
          <div>
            <div className="font-bold">{t('addedToCart')}</div>
            <div className="text-sm opacity-90">{t('viewInDashboard')}</div>
          </div>
        </div>
      )}

      <div className="relative h-[500px] md:h-[600px] overflow-hidden">
        <img src={job.image || 'https://placehold.co/1920x600?text=Job+Image'} alt={job.title} className="w-full h-full object-cover parallax-slow" />
        <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/70 to-transparent"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
          <div className="max-w-4xl">
            <Badge variant="lime" className="mb-4">{job.type}</Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-6 text-gray-300">
              <span className="flex items-center gap-2"><MapPin className="w-5 h-5 text-sari-lime" /> {job.location}</span>
              <span className="flex items-center gap-2"><Euro className="w-5 h-5 text-sari-lime" /> <strong>{job.salary}</strong></span>
              <span className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-sari-lime" /> {job.typeTravail || t('fullTime')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-sari-blue text-white py-6">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 flex items-center justify-center rounded-full">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-lg">{t('joinTeam')}</div>
                <div className="text-sm text-blue-100">{t('joinTeamDesc')}</div>
              </div>
            </div>
            {alreadyApplied ? (
              <div className="flex items-center gap-2 bg-green-500/20 border-2 border-green-400 px-6 py-3 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="font-bold">{t('alreadyApplied')}</span>
              </div>
            ) : (
              <CTAButton onClick={handleQuickApply} variant="lime" icon="send">
                {t('applyNow')}
              </CTAButton>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <Breadcrumb items={[
          { label: t('home'), href: '/' },
          { label: t('careers'), href: '/careers' },
          { label: job.title }
        ]} />
        
        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
              <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                <div className="w-12 h-12 bg-sari-blue flex items-center justify-center rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                {t('jobDesc')}
              </h2>
              <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: job.fullDesc || '' }} />
            </div>

            {job.mission && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                  <div className="w-12 h-12 bg-sari-lime flex items-center justify-center rounded-lg">
                    <Target className="w-6 h-6 text-sari-dark" />
                  </div>
                  {t('missions')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">{job.mission}</p>
                {job.objectifs && job.objectifs.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-4">{t('objectives')}</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {job.objectifs.map((obj, i) => (
                        <div key={i} className="flex items-start gap-3 p-4 bg-sari-lime/10 border border-sari-lime/30 rounded-lg">
                          <div className="w-8 h-8 bg-sari-lime flex items-center justify-center flex-shrink-0 rounded-full">
                            <span className="text-sari-dark font-bold text-sm">{i + 1}</span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400">{obj}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
              <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-6 flex items-center gap-3">
                <div className="w-12 h-12 bg-sari-blue flex items-center justify-center rounded-lg">
                  <UserCheck className="w-6 h-6 text-white" />
                </div>
                {t('profile')}
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                {job.prerequis && job.prerequis.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-4">{t('prerequisites')}</h3>
                    <ul className="space-y-3">
                      {job.prerequis.map((prereq, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-sari-blue flex-shrink-0 mt-0.5" />
                          <span className="text-gray-600 dark:text-gray-400">{prereq}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {job.experience && (
                  <div>
                    <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-4">{t('experience')}</h3>
                    <div className="bg-sari-blue/5 border border-sari-blue/20 p-6 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <Award className="w-6 h-6 text-sari-blue" />
                        <span className="font-bold text-sari-dark dark:text-white">{t('requiredExp')}</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">{job.experience}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(prevJob || nextJob) && (
              <div className="grid md:grid-cols-2 gap-6">
                {prevJob ? (
                  <Link href={`/${locale}/emplois/${prevJob.id}`} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 hover:border-sari-blue transition-all group rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      {t('prevJob')}
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2">{prevJob.title}</h3>
                  </Link>
                ) : <div></div>}
                {nextJob ? (
                  <Link href={`/${locale}/emplois/${nextJob.id}`} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 hover:border-sari-blue transition-all group text-right rounded-xl">
                    <div className="flex items-center justify-end gap-2 text-sm text-gray-500 mb-2">
                      {t('nextJob')}
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2">{nextJob.title}</h3>
                  </Link>
                ) : <div></div>}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl sticky top-32">
              <h3 className="text-2xl font-bold text-sari-dark dark:text-white mb-4 text-center">{t('interested')}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">{t('interestedDesc')}</p>
              
              {alreadyApplied ? (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 p-6 text-center rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <h4 className="font-bold text-green-700 dark:text-green-400">{t('alreadyAppliedTitle')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('alreadyAppliedDesc')}</p>
                  <Link href={`/${locale}/dashboard`} className="mt-4 btn-primary text-white px-6 py-2 inline-block font-semibold rounded-lg">
                    {t('viewDashboard')}
                  </Link>
                </div>
              ) : applicationSubmitted ? (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 p-6 text-center rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <h4 className="font-bold text-green-700 dark:text-green-400">{t('applicationSent')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('applicationSentDesc')}</p>
                </div>
              ) : !showApplicationForm ? (
                <CTAButton onClick={() => setShowApplicationForm(true)} variant="primary" icon="send" fullWidth>
                  {t('applyNow')}
                </CTAButton>
              ) : (
                <form onSubmit={handleApplication} className="space-y-4">
                  <input type="text" required placeholder={t('fullName')} value={appFormData.name} onChange={(e) => setAppFormData({...appFormData, name: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  <input type="email" required placeholder={t('email')} value={appFormData.email} onChange={(e) => setAppFormData({...appFormData, email: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  <input type="tel" placeholder={t('phone')} value={appFormData.phone} onChange={(e) => setAppFormData({...appFormData, phone: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  <input type="text" placeholder={t('linkedin')} value={appFormData.linkedin} onChange={(e) => setAppFormData({...appFormData, linkedin: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  <input type="text" placeholder={t('yearsExp')} value={appFormData.experience} onChange={(e) => setAppFormData({...appFormData, experience: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg" />
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-center hover:border-sari-blue transition-colors rounded-lg">
                    <input type="file" id="cv-upload" accept=".pdf,.doc,.docx" onChange={(e) => { if (e.target.files && e.target.files[0]) setAppFormData({...appFormData, cvName: e.target.files[0].name}); }} className="hidden" />
                    <label htmlFor="cv-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{appFormData.cvName || t('uploadCv')}</p>
                      <p className="text-xs text-gray-400 mt-1">{t('cvFormats')}</p>
                    </label>
                  </div>
                  <textarea rows={4} required placeholder={t('motivation')} value={appFormData.motivation} onChange={(e) => setAppFormData({...appFormData, motivation: e.target.value})} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none resize-none rounded-lg"></textarea>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" id="accept-terms" required checked={appFormData.acceptTerms} onChange={(e) => setAppFormData({...appFormData, acceptTerms: e.target.checked})} className="w-4 h-4 mt-1" />
                    <label htmlFor="accept-terms" className="text-xs text-gray-600 dark:text-gray-400">{t('acceptTerms')}</label>
                  </div>
                  <CTAButton type="submit" variant="primary" fullWidth>{t('sendApplication')}</CTAButton>
                  <button type="button" onClick={() => setShowApplicationForm(false)} className="w-full text-gray-500 hover:text-sari-dark dark:hover:text-white text-sm">{t('cancel')}</button>
                </form>
              )}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('question')}</p>
                <Link href={`/${locale}/contact`} className="text-sari-blue font-semibold hover:underline inline-flex items-center gap-2">
                  {t('contactUs')} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-6">{t('jobDetails')}</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Briefcase className="w-5 h-5 text-sari-blue flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('contractType')}</div>
                    <div className="font-semibold text-sari-dark dark:text-white">{job.type}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-sari-blue flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('location')}</div>
                    <div className="font-semibold text-sari-dark dark:text-white">{job.location}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Euro className="w-5 h-5 text-sari-blue flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('salary')}</div>
                    <div className="font-semibold text-sari-dark dark:text-white">{job.salary}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-sari-blue flex-shrink-0 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('hrContact')}</div>
                    <a href={`mailto:${job.contact}`} className="font-semibold text-sari-blue hover:underline text-sm">{job.contact}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}