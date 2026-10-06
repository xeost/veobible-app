"use client";
import { useEffect, useState } from "react";
import { X, Users } from "lucide-react";
import { api } from "./api";
export function UsersPanel({
  close,
  currentId,
}: {
  close: () => void;
  currentId: string;
}) {
  const [users, setUsers] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("users")
      .then((d) => setUsers(d.users))
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Usuarios"
      >
        <div className="modal-title">
          <h2>
            <Users size={22} /> Usuarios del dashboard
          </h2>
          <button className="icon-button" aria-label="Cerrar" onClick={close}>
            <X />
          </button>
        </div>
        <p className="muted">
          Los administradores gestionan usuarios y deployments. Los editores
          producen y organizan videos.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acceso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <small>{u.username}</small>
                  </td>
                  <td>
                    <select
                      disabled={u.id === currentId}
                      value={u.role}
                      onChange={async (e) => {
                        try {
                          await api(`users/${u.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ role: e.target.value }),
                          });
                          await load();
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      <option>admin</option>
                      <option>editor</option>
                    </select>
                  </td>
                  <td>
                    <button
                      disabled={u.id === currentId}
                      onClick={async () => {
                        try {
                          await api(`users/${u.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ active: !u.active }),
                          });
                          await load();
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Agregar usuario</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = e.currentTarget;
            try {
              await api("users", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
              });
              form.reset();
              await load();
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Usuario
              <input name="username" pattern="[a-zA-Z0-9_.-]{3,60}" required />
            </label>
            <label>
              Nombre
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <label>
              Rol
              <select name="role">
                <option>editor</option>
                <option>admin</option>
              </select>
            </label>
            <label>
              Contraseña
              <input name="password" type="password" minLength={12} required />
            </label>
          </div>
          <button className="primary" disabled={busy}>
            Crear usuario
          </button>
        </form>
      </section>
    </div>
  );
}
