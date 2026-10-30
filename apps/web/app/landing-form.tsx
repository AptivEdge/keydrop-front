import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Card } from "@keydrop/ui";

export default function LandingForm() {
  return (
    <Card className="kd-create-card">
      <div className="kd-create-card-heading">
        <span className="kd-create-lock"><LockKeyhole aria-hidden="true" /></span>
        <div>
          <h2 id="create-title">Secure sharing with a paid plan</h2>
          <p>Choose Pro or Team to create encrypted secret links.</p>
        </div>
      </div>
      <Link
        className="kd-button kd-button--neutral kd-create-submit"
        href="/pricing"
      >
        Compare paid plans <ArrowRight aria-hidden="true" />
      </Link>
      <p className="kd-create-note">
        Your secret is encrypted in your browser before it is sent.
      </p>
    </Card>
  );
}
