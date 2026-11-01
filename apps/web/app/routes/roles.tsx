import { redirect } from "react-router";

// «Люди й ролі» is now part of «Мешканці».
export function loader() {
  throw redirect("/residents");
}
