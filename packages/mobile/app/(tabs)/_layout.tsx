import { Tabs } from "expo-router";
import { PaperTabBar } from "@/components/paper-tab-bar";
import { TabIcon } from "@/components/tab-icon";
export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <PaperTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="today"
              focused={focused}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="progress"
              focused={focused}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ranks"
        options={{
          title: "Ranks",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="ranks"
              focused={focused}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="calendar"
              focused={focused}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="profile"
              focused={focused}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
