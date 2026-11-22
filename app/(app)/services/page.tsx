import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { updateService } from "@/app/actions";
import { getContext } from "@/lib/context";
import type { Service } from "@/lib/types";

export default async function Services() {
  const ctx = await getContext();
  if (!ctx.isManager) redirect("/calendar");
  const { data } = await ctx.supabase.from("services").select("*").eq("business_id", ctx.business.id).order("sort");
  const services = (data ?? []) as Service[];
  return (
    <>
      <TopBar title="Services" sub="Prices here are used for every new job" />
      <div className="view stack">
        {services.map((s) => (
          <form key={s.id} action={updateService} className="panel">
            <input type="hidden" name="id" value={s.id} />
            <div className="panel-b" style={{ display: "grid", gap: 12 }}>
              <div className="grid2">
                <div className="field"><label htmlFor={`n-${s.id}`}>Service</label><input className="in" id={`n-${s.id}`} name="name" defaultValue={s.name} /></div>
                <div className="field"><label htmlFor={`d-${s.id}`}>Hours on the job (car size)</label><input className="in" id={`d-${s.id}`} name="duration_hours" type="number" min="0" step="0.25" defaultValue={Number(s.duration_hours)} /></div>
              </div>
              <div className="grid3">
                <div className="field"><label htmlFor={`a-${s.id}`}>Car / Sedan $</label><input className="in" id={`a-${s.id}`} name="price_sedan" type="number" min="0" defaultValue={Number(s.price_sedan)} /></div>
                <div className="field"><label htmlFor={`b-${s.id}`}>SUV / Crossover $</label><input className="in" id={`b-${s.id}`} name="price_suv" type="number" min="0" defaultValue={Number(s.price_suv)} /></div>
                <div className="field"><label htmlFor={`c-${s.id}`}>Truck / 7-seat $</label><input className="in" id={`c-${s.id}`} name="price_large" type="number" min="0" defaultValue={Number(s.price_large)} /></div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="bookable" defaultChecked={s.bookable} />Show on booking page</label>
                <span className="muted" style={{ fontSize: 12.5 }}>{s.checklist.length}-step checklist{s.is_plan ? " · monthly plan" : ""}</span>
                <span className="grow" />
                <button className="btn pri">Save</button>
              </div>
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
