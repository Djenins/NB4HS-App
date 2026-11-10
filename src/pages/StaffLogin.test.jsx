// StaffLogin.test.jsx -- two-step sign-in (s1). The password alone never
// finishes sign-in: a staff member without an authenticator is shown the QR
// code to set one up, one with an authenticator is asked for the code, and
// only a verified code reaches the profile check and the landing page.
// Supabase Auth is mocked; what's under test is the page's flow.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

const showToast = vi.fn();
const navigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock("../context/AppContext.jsx", () => ({
  useApp: () => ({ data: { classes: [], visits: [], appointments: [], workforceRoleAccess: {} }, showToast }),
  useT: () => (key) => translate(key, "en")
}));
vi.mock("../lib/supabaseAuth.js", () => ({
  signIn: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), fetchProfile: vi.fn(),
  mfaStep: vi.fn(), startTotpEnrollment: vi.fn(), verifiedTotpFactor: vi.fn(), verifyTotp: vi.fn()
}));
vi.mock("../lib/supabase.js", () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) } }
}));
vi.mock("../lib/workspaces.js", () => ({ AUTH_MODEL: "legacy", landingItem: () => null }));
vi.mock("../lib/useNavItems.js", () => ({ resolveNavItems: () => ({ items: [] }) }));
vi.mock("../components/ThemeToggle.jsx", () => ({ default: () => null }));

import * as auth from "../lib/supabaseAuth.js";
import StaffLogin from "./StaffLogin.jsx";

const ACTIVE = { id: "u1", role: "staff", active: true };

async function signInWithPassword() {
  render(<MemoryRouter><StaffLogin /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "staff@nb4hs.org" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "a long password" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("StaffLogin two-step sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mfaStep.mockResolvedValue(null);
    auth.signIn.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    auth.fetchProfile.mockResolvedValue(ACTIVE);
  });

  it("shows the QR code to someone without an authenticator, and signs in once the code verifies", async () => {
    auth.mfaStep.mockResolvedValueOnce(null);
    auth.mfaStep.mockResolvedValue("enroll");
    auth.startTotpEnrollment.mockResolvedValue({ factorId: "f1", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "ABC123" });
    await signInWithPassword();
    expect(await screen.findByText("Set up two-step sign-in")).toBeInTheDocument();
    expect(screen.getByAltText(/QR code/i)).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(auth.fetchProfile).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: "12 34 56" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));
    await waitFor(() => expect(auth.verifyTotp).toHaveBeenCalledWith("f1", "123456"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(auth.fetchProfile).toHaveBeenCalledWith("u1");
  });

  it("asks for the code when an authenticator exists, and stays put on a wrong code", async () => {
    auth.mfaStep.mockResolvedValueOnce(null).mockResolvedValue("verify");
    auth.verifiedTotpFactor.mockResolvedValue({ id: "f9" });
    auth.verifyTotp.mockRejectedValue(new Error("invalid code"));
    await signInWithPassword();
    expect(await screen.findByText("Enter your code")).toBeInTheDocument();
    expect(screen.queryByAltText(/QR code/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/didn't work/)));
    expect(navigate).not.toHaveBeenCalled();
    expect(auth.fetchProfile).not.toHaveBeenCalled();
  });

  it("resumes at the code step when the page reloads mid sign-in", async () => {
    auth.mfaStep.mockResolvedValue("verify");
    auth.verifiedTotpFactor.mockResolvedValue({ id: "f9" });
    render(<MemoryRouter><StaffLogin /></MemoryRouter>);
    expect(await screen.findByText("Enter your code")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /different account/i }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
  });

  it("goes straight in when the session is already verified", async () => {
    auth.mfaStep.mockResolvedValueOnce(null).mockResolvedValue("done");
    await signInWithPassword();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(auth.startTotpEnrollment).not.toHaveBeenCalled();
  });
});
