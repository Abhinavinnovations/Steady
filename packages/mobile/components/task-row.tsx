import { useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useFocusBalance } from "@/hooks/use-focus-balance";
import type { FocusIdentity } from "@/lib/focus-progress";
import { useColors } from "@/hooks/use-colors";
export function TaskRow({title,subtitle,done,flagged,consistent,onPress,onCheck,onSchedule,onFlag,onFocus,onDelete,children,focusIdentity}:{focusIdentity?:FocusIdentity;title:string;subtitle:string;done:boolean;flagged:boolean;consistent?:boolean;onPress:()=>void;onCheck?:()=>void;onSchedule:()=>void;onFlag:()=>void;onFocus?:()=>void;onDelete?:()=>void;children?:React.ReactNode}) {
  const balance=useFocusBalance(focusIdentity);
  const c=useColors(); const [open,setOpen]=useState(false);
  const pan=useRef(PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>24&&Math.abs(g.dx)>Math.abs(g.dy)*2,onPanResponderRelease:(_,g)=>{if(g.dx< -30)setOpen(true);if(g.dx>30)setOpen(false);}})).current;
  const actions=[{name:"Schedule",icon:"calendar-outline",run:onSchedule},{name:flagged?"Unflag":"Flag",icon:flagged?"flag":"flag-outline",run:onFlag},...(onFocus?[{name:"Focus",icon:"timer-outline",run:onFocus}]:[]),...(onDelete?[{name:"Delete",icon:"trash-outline",run:onDelete}]:[])];
  return <View {...pan.panHandlers} style={{borderBottomWidth:1,borderColor:flagged?c.primary:c.border,backgroundColor:"transparent",overflow:"hidden"}}>
    <View style={{flexDirection:"row",alignItems:"center",padding:8,paddingVertical:10}}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`${done?"Undo":"Complete"} ${title}`} accessibilityState={{checked:done}} aria-checked={done} onPress={onCheck??onPress} style={{width:44,height:48,alignItems:"center",justifyContent:"center"}}><Ionicons name={done?"checkmark-circle":consistent?"ellipse-outline":"square-outline"} size={25} color={done?c.success:c.mutedForeground}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onPress} onLongPress={()=>setOpen(true)} style={{flex:1,paddingVertical:8,gap:5}}>
        <Text style={{color:done?c.mutedForeground:c.foreground,fontFamily:Fonts.medium,fontSize:15,lineHeight:22,textDecorationLine:done&&!consistent?"line-through":"none"}}>{title}</Text>
        {!!subtitle&&<Text style={{color:c.mutedForeground,fontFamily:Fonts.sans,fontSize:11,lineHeight:17}}>{subtitle}</Text>}
        {balance&&<Text style={{color:c.mutedForeground,fontFamily:Fonts.sans,fontSize:12,lineHeight:18}}>{balance}</Text>}
      </Pressable>
      {flagged&&<Ionicons name="flag" size={14} color={c.primary}/>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${title}`} accessibilityState={{expanded:open}} aria-expanded={open} onPress={()=>setOpen(!open)} style={{height:44,width:44,alignItems:"center",justifyContent:"center"}}><Ionicons name={open?"chevron-up":"ellipsis-horizontal"} size={20} color={c.mutedForeground}/></Pressable>
    </View>
    {children&&<View style={{paddingHorizontal:18,paddingBottom:16}}>{children}</View>}
    {open&&<View style={{flexDirection:"row",flexWrap:"wrap",borderTopWidth:1,borderColor:c.border,backgroundColor:c.secondary}}>{actions.map(a=><Pressable key={a.name} accessibilityRole="button" accessibilityLabel={`${a.name} ${title}`} onPress={()=>{setOpen(false);a.run();}} style={{flex:1,minWidth:70,minHeight:44,alignItems:"center",paddingVertical:13,gap:5}}><Ionicons name={a.icon as any} size={20} color={a.name==="Delete"?c.destructive:c.primary}/><Text style={{alignSelf:"stretch",textAlign:"center",color:a.name==="Delete"?c.destructive:c.foreground,fontFamily:Fonts.medium,fontSize:10}}>{a.name}</Text></Pressable>)}</View>}
  </View>;
}
