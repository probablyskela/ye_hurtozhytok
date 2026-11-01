import { redirect } from "react-router";

// «Мої записи» now live in «Моє»; old links and installed shortcuts land there.
export function loader() {
  throw redirect("/me");
}
