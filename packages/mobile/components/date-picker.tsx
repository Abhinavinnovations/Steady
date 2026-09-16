import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { addDays, REPEATS, repeatLabels, type Repeat } from "@/lib/recurrence";

export function RepeatPicker({ value, onChange, disabled = false }: { disabled?: boolean; value: Repeat; onChange: (value: Repeat) => void }) {
  const c = useColors();
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.mutedForeground, fontFamily: Fonts.semibold, fontSize: 11, letterSpacing: 1.2 }}>REPEAT · TO-DOS ONLY</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {REPEATS.map(r => <Pressable disabled={disabled} key={r} accessibilityRole="radio" accessibilityState={{ checked: r === value, disabled }} aria-checked={r === value} aria-disabled={disabled} onPress={() => onChange(r)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: r === value ? c.primary : c.border, backgroundColor: r === value ? c.primarySoft : c.card }}>
        <Text style={{ color: r === value ? c.primary : c.mutedForeground, fontFamily: Fonts.medium, fontSize: 12 }}>{repeatLabels[r]}</Text>
      </Pressable>)}
    </View>
    {value !== "none" && <Text style={{ color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 12 }}>Each date has its own checkoff. Missed repeats do not pile up in Today. No streak impact.</Text>}
  </View>;
}
export function DatePicker({ value, onChange, todayISO, disabled = false }: { disabled?: boolean; value: string; onChange: (value: string) => void; todayISO: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [month, setMonth] = useState(value.slice(0,7));
  const [y,m] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(y,m-1,1)).getUTCDay();
  const length = new Date(Date.UTC(y,m,0)).getUTCDate();
  const cells = Array.from({length: Math.ceil((lead+length)/7)*7},(_,i) => i-lead+1);
  function shift(n:number) { setMonth(new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7)); }
  return <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)} style={{gap:8}}>
    <Text style={{color:c.mutedForeground,fontFamily:Fonts.semibold,fontSize:11,letterSpacing:1.2}}>DATE</Text>
    <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
      {[{label:"Today",date:todayISO},{label:"Tomorrow",date:addDays(todayISO,1)}].map(x => <Pressable disabled={disabled} key={x.label} accessibilityRole="button" accessibilityState={{ selected: value === x.date }} aria-pressed={value === x.date} onPress={()=>onChange(x.date)} style={{minHeight:44,paddingHorizontal:14,justifyContent:"center",borderRadius:12,borderWidth:1,borderColor:value===x.date?c.primary:c.border,backgroundColor:value===x.date?c.primarySoft:c.card}}><Text style={{fontFamily:Fonts.medium,color:value===x.date?c.primary:c.foreground,fontSize:13}}>{x.label}</Text></Pressable>)}
      <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Choose date" accessibilityState={{expanded:open}} aria-expanded={open} onPress={()=>{setMonth(value.slice(0,7));setOpen(!open);}} style={{minHeight:44,flexDirection:"row",gap:6,alignItems:"center",paddingHorizontal:12,borderWidth:1,borderColor:c.border,borderRadius:12}}><Ionicons name="calendar-outline" size={17} color={c.primary}/><Text style={{color:c.foreground,fontFamily:Fonts.medium,fontSize:12}}>{value}</Text></Pressable>
    </View>
    {open && <>
    {availableWidth < 330 && <Text style={{color:c.mutedForeground,fontFamily:Fonts.sans,fontSize:12}}>Swipe the calendar sideways to see all seven days.</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={{minWidth:330,flexGrow:1}}>
    <View style={{flex:1,padding:10,borderWidth:1,borderColor:c.border,borderRadius:16,backgroundColor:c.card}}>
      <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
        <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Previous month" onPress={()=>shift(-1)} style={{padding:12}}><Ionicons name="chevron-back" size={20} color={c.foreground}/></Pressable>
        <Text style={{flex:1,textAlign:"center",color:c.foreground,fontFamily:Fonts.semibold}}>{new Date(Date.UTC(y,m-1,1)).toLocaleDateString("en",{month:"long",year:"numeric",timeZone:"UTC"})}</Text>
        <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Next month" onPress={()=>shift(1)} style={{padding:12}}><Ionicons name="chevron-forward" size={20} color={c.foreground}/></Pressable>
      </View>
      <View style={{flexDirection:"row"}}>{["S","M","T","W","T","F","S"].map((d,i)=><Text key={i} style={{width:"14.2857%",textAlign:"center",color:c.mutedForeground,fontFamily:Fonts.sans,fontSize:11}}>{d}</Text>)}</View>
      <View style={{flexDirection:"row",flexWrap:"wrap"}}>{cells.map((d,i)=>{
        const date=`${month}-${String(d).padStart(2,"0")}`;const active=date===value;
        return d<1||d>length?<View key={i} style={{width:"14.2857%",minHeight:44}}/>:<Pressable disabled={disabled} key={i} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{selected:active}} aria-pressed={active} onPress={()=>{onChange(date);setOpen(false);}} style={{width:"14.2857%",minHeight:44,paddingVertical:8,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:active?c.primary:"transparent"}}><Text style={{fontFamily:Fonts.medium,color:active?c.primaryForeground:date===todayISO?c.primary:c.foreground}}>{d}</Text></Pressable>;
      })}</View>
    </View></ScrollView></>}
  </View>;
}
