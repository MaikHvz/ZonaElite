import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.SMTP_FROM || "ZonaElite <no-reply@zonaelite.cl>";

export async function sendWelcomeEmail(email: string, name: string, tempPassword: string) {
  const academyName = "ZONAELITE";
  const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://zona-elite-six.vercel.app"}/auth`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin:0; padding:0; background:#131313; font-family:'Segoe UI',Arial,sans-serif; }
    .container { max-width:560px; margin:0 auto; padding:32px 24px; }
    .header { text-align:center; padding:32px 0 24px; }
    .header h1 { color:#ffb4ac; font-size:28px; font-weight:900; letter-spacing:2px; margin:0; text-transform:uppercase; }
    .card { background:#1e1e1e; border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:32px; margin:16px 0; }
    .card h2 { color:#ffffff; font-size:20px; margin:0 0 16px; }
    .card p { color:rgba(255,255,255,0.7); font-size:14px; line-height:1.6; margin:0 0 12px; }
    .credentials { background:rgba(255,180,172,0.08); border:1px solid rgba(255,180,172,0.2); border-radius:12px; padding:20px; margin:20px 0; }
    .credentials .label { color:rgba(255,255,255,0.5); font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .credentials .value { color:#ffffff; font-size:16px; font-weight:600; margin-bottom:16px; word-break:break-all; }
    .credentials .value:last-child { margin-bottom:0; }
    .btn { display:inline-block; background:linear-gradient(135deg,#ff544c,#ffb4ac); color:#131313; font-weight:700; text-decoration:none; padding:14px 32px; border-radius:12px; font-size:14px; text-transform:uppercase; letter-spacing:1px; margin-top:8px; }
    .footer { text-align:center; padding:24px 0; color:rgba(255,255,255,0.3); font-size:12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${academyName}</h1>
    </div>
    <div class="card">
      <h2>Bienvenido a ${academyName}</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Tu cuenta ha sido creada exitosamente. Puedes iniciar sesión con las siguientes credenciales:</p>
      <div class="credentials">
        <div class="label">Email</div>
        <div class="value">${email}</div>
        <div class="label">Contraseña temporal</div>
        <div class="value">${tempPassword}</div>
      </div>
      <p style="color:rgba(255,180,172,0.7);font-size:13px;">Te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.</p>
      <div style="text-align:center;">
        <a href="${loginUrl}" class="btn">Iniciar Sesión</a>
      </div>
    </div>
    <div class="footer">
      <p>${academyName} — Academia de Artes Marciales, La Serena, Chile</p>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `Bienvenido a ${academyName} — Tus credenciales de acceso`,
    html,
  });
}
