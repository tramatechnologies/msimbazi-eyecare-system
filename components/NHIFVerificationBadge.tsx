/**
 * NHIF Verification Badge Component
 * Displays NHIF verification status across all modules
 */

import React, { useState, useEffect } from 'react';
import { AuthorizationStatus, VisitType } from '../types';
import { getActiveNHIFVerification } from '../services/nhifService';

interface NHIFVerificationBadgeProps {
  visitId: string | null;
  compact?: boolean;
}

const NHIFVerificationBadge: React.FC<NHIFVerificationBadgeProps> = ({ visitId, compact = false }) => {
  const [verification, setVerification] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visitId) {
      setIsLoading(true);
      getActiveNHIFVerification(visitId)
        .then((result) => {
          setVerification(result);
        })
        .catch((error) => {
          console.error('Error fetching NHIF verification:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [visitId]);

  if (!visitId || isLoading) {
    return null;
  }

  if (!verification) {
    return null;
  }

  const getStatusConfig = () => {
    switch (verification.authorizationStatus) {
      case AuthorizationStatus.ACCEPTED:
        return {
          bg: 'bg-emerald-500',
          text: 'text-white',
          icon: 'fa-check-circle',
          label: 'VERIFIED',
        };
      case AuthorizationStatus.REJECTED:
      case AuthorizationStatus.INVALID:
        return {
          bg: 'bg-red-500',
          text: 'text-white',
          icon: 'fa-times-circle',
          label: 'REJECTED',
        };
      case AuthorizationStatus.UNKNOWN:
        return {
          bg: 'bg-yellow-500',
          text: 'text-white',
          icon: 'fa-exclamation-triangle',
          label: 'WARNING',
        };
      case AuthorizationStatus.PENDING:
        return {
          bg: 'bg-blue-500',
          text: 'text-white',
          icon: 'fa-clock',
          label: 'PENDING',
        };
      default:
        return {
          bg: 'bg-slate-500',
          text: 'text-white',
          icon: 'fa-question-circle',
          label: 'UNKNOWN',
        };
    }
  };

  const config = getStatusConfig();
  const visitTypeLabels: Record<number, string> = {
    1: 'Normal',
    2: 'Emergency',
    3: 'Referral',
    4: 'Follow-up',
  };

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${config.bg} ${config.text}`}>
        <i className={`fas ${config.icon}`}></i>
        NHIF: {config.label}
        {verification.authorizationNo && (
          <span className="font-mono text-[10px] opacity-90">
            ({verification.authorizationNo.substring(0, 8)}...)
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={`p-4 rounded-xl border-2 ${config.bg} ${config.text} shadow-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <i className={`fas ${config.icon} text-lg`}></i>
            <span className="font-black text-sm uppercase tracking-wider">
              NHIF: {config.label}
            </span>
          </div>
          
          {verification.authorizationNo && (
            <div className="mt-2">
              <p className="text-xs opacity-90 mb-1">Authorization Number:</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-bold bg-white/20 px-2 py-1 rounded">
                  {verification.authorizationNo}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(verification.authorizationNo);
                  }}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors"
                  title="Copy authorization number"
                >
                  <i className="fas fa-copy text-xs"></i>
                </button>
              </div>
            </div>
          )}

          {verification.memberName && (
            <p className="text-xs mt-2 opacity-90">
              Member: <span className="font-semibold">{verification.memberName}</span>
            </p>
          )}

          {verification.cardStatus && (
            <p className="text-xs mt-1 opacity-90">
              Card Status: <span className="font-semibold">{verification.cardStatus}</span>
            </p>
          )}

          <p className="text-xs mt-2 opacity-90">
            Visit Type: <span className="font-semibold">{visitTypeLabels[verification.visitTypeId] || 'Unknown'}</span>
          </p>

          {verification.remarks && (
            <p className="text-xs mt-2 opacity-90 italic">
              {verification.remarks}
            </p>
          )}

          {verification.authorizationStatus === AuthorizationStatus.UNKNOWN && (
            <div className="mt-3 p-2 bg-yellow-600/30 rounded-lg border border-yellow-400/50">
              <p className="text-xs font-semibold">
                ⚠️ Warning: Please verify at NHIF office
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NHIFVerificationBadge;
