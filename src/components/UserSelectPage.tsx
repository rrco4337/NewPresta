import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomer } from '../contexts/CustomerContext';
import {
  fetchCustomerList,
  fetchSecureKey,
  type CustomerSummary,
} from '../services/customerService';

const skeletonItems = Array.from({ length: 4 }, (_, i) => i);

function formatDisplayName(user: CustomerSummary): string {
  const name = `${user.firstname} ${user.lastname}`.trim();
  if (name) return name;
  if (user.email) return user.email;
  return `Utilisateur #${user.id}`;
}

function initialsFrom(user: CustomerSummary): string {
  const first = user.firstname?.trim().charAt(0) ?? '';
  const last = user.lastname?.trim().charAt(0) ?? '';
  const email = user.email?.trim().charAt(0) ?? '';
  return (first + last || email || user.id.charAt(0)).toUpperCase();
}

const UserSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const { setCustomer } = useCustomer();

  const [users, setUsers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchCustomerList()
      .then((list) => {
        if (!active) return;
        setUsers(list);
      })
      .catch(() => {
        if (!active) return;
        setError('Impossible de charger les utilisateurs.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = formatDisplayName(a).toLowerCase();
      const nameB = formatDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  const handleSelectUser = async (user: CustomerSummary) => {
    setSelectingId(user.id);
    setError(null);
    try {
      const secureKey = await fetchSecureKey(user.id);
      setCustomer({
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        secureKey,
      });
      navigate('/shop', { replace: true });
    } catch {
      setError('Impossible de demarrer la session.');
    } finally {
      setSelectingId(null);
    }
  };

  const handleAnonymous = () => {
    setCustomer(null);
    navigate('/shop', { replace: true });
  };

  const showEmpty = !loading && sortedUsers.length === 0 && !error;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-amber-50">
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-12 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                Demarrage rapide
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Choisir un utilisateur
              </h1>
            </div>
            <Link
              to="/login"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
            >
              Acces back-office
            </Link>
          </div>
          <p className="max-w-2xl text-base text-slate-600">
            Selectionnez un compte pour ouvrir la session ou continuez en mode anonyme.
            Vous pourrez toujours changer plus tard.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.25fr,0.75fr]">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Utilisateurs disponibles</h2>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {loading ? 'Chargement' : `${sortedUsers.length} utilisateur(s)`}
              </span>
            </div>

            {loading && (
              <div className="grid gap-4 sm:grid-cols-2">
                {skeletonItems.map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                        <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                      </div>
                    </div>
                    <div className="mt-4 h-9 w-full rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!loading && sortedUsers.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {sortedUsers.map((user) => {
                  const isSelecting = selectingId === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      disabled={!!selectingId}
                      className="group flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                          {initialsFrom(user)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {formatDisplayName(user)}
                          </p>
                          <p className="text-sm text-slate-500">{user.email || `ID ${user.id}`}</p>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {isSelecting ? 'Ouverture...' : 'Connexion rapide'}
                        </span>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition group-hover:border-emerald-200 group-hover:text-emerald-700">
                          {isSelecting ? 'Chargement' : 'Ouvrir'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {showEmpty && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600">
                <p className="text-base font-semibold text-slate-900">Aucun utilisateur trouve</p>
                <p className="mt-2">
                  Vous pouvez creer un compte via la page client ou importer des utilisateurs.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/shop/auth"
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Creer un compte
                  </Link>
                  <Link
                    to="/import"
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                  >
                    Importer des utilisateurs
                  </Link>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">Option rapide</p>
                <span className="rounded-full border border-emerald-200/60 px-3 py-1 text-xs font-semibold text-emerald-50">
                  Highlight
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold">Utilisateur anonyme</h3>
              <p className="mt-3 text-sm text-emerald-50/90">
                Accedez a la boutique sans compte. Vous pourrez finaliser plus tard si besoin.
              </p>
              <button
                type="button"
                onClick={handleAnonymous}
                className="mt-6 w-full rounded-full bg-white/95 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-white"
              >
                Continuer sans compte
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
              <p className="text-base font-semibold text-slate-900">Pourquoi choisir un compte ?</p>
              <ul className="mt-3 space-y-2">
                <li>Suivi des commandes en un clic</li>
                <li>Synchronisation du panier avec PrestaShop</li>
                <li>Checkout plus rapide avec vos adresses</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default UserSelectPage;
