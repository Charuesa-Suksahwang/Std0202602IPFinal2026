import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function App() {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [employees, setEmployees] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [clusters, setClusters] = useState(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try { setEmployees(await request('/api/employees', token)); }
    catch (error) { Alert.alert('Could not load employees', error.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { if (token) loadEmployees(); }, [token, loadEmployees]);

  async function login() {
    if (!username.trim() || !password) return Alert.alert('Missing information', 'Enter both username and password.');
    try { const result = await request('/api/login', '', { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) }); setToken(result.token); }
    catch (error) { Alert.alert('Login failed', error.message); }
  }
  async function addEmployee() {
    if (!name.trim() || !position.trim() || !salary.trim()) return Alert.alert('Missing information', 'Enter name, position, and salary.');
    const parsedSalary = Number(salary);
    if (!Number.isSafeInteger(parsedSalary) || parsedSalary < 0 || parsedSalary > 2147483647) return Alert.alert('Invalid salary', 'Salary must be a whole number from 0 to 2,147,483,647.');
    try {
      await request('/api/employees', token, { method: 'POST', body: JSON.stringify({ name: name.trim(), position: position.trim(), salary: parsedSalary }) });
      setName(''); setPosition(''); setSalary(''); setClusters(null); await loadEmployees();
    } catch (error) { Alert.alert('Could not add employee', error.message); }
  }
  async function toggleStatus(id) {
    try { const updated = await request(`/api/employees/${encodeURIComponent(id)}/status`, token, { method: 'PUT' }); setEmployees((items) => items.map((item) => item.id === id ? updated : item)); setClusters(null); }
    catch (error) { Alert.alert('Could not update status', error.message); }
  }
  function confirmDelete(employee) {
    Alert.alert('Confirm delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await request(`/api/employees/${encodeURIComponent(employee.id)}`, token, { method: 'DELETE' }); setEmployees((items) => items.filter((item) => item.id !== employee.id)); setClusters(null); }
        catch (error) { Alert.alert('Could not delete employee', error.message); }
      } },
    ]);
  }
  async function analyze() {
    setAnalyzing(true); setClusters(null);
    try { setClusters(await request('/api/employees/salary-clusters', token)); }
    catch (error) { Alert.alert('Analysis failed', error.message); }
    finally { setAnalyzing(false); }
  }

  return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {!token ? <View style={styles.login}><Text style={styles.title}>HR Manager</Text><Text style={styles.subtitle}>Sign in to manage your team</Text>
      <TextInput style={styles.input} placeholder="Username" autoCapitalize="none" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={login} />
      <TouchableOpacity style={styles.primary} onPress={login}><Text style={styles.primaryText}>Log in</Text></TouchableOpacity>
    </View> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><View><Text style={styles.title}>Dashboard</Text><Text style={styles.subtitle}>Employee management</Text></View><TouchableOpacity onPress={() => { setToken(''); setClusters(null); }}><Text style={styles.logout}>Log out</Text></TouchableOpacity></View>
      <View style={styles.card}><Text style={styles.sectionTitle}>Add employee</Text>
        <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Position" value={position} onChangeText={setPosition} />
        <TextInput style={styles.input} placeholder="Salary" keyboardType="number-pad" value={salary} onChangeText={setSalary} />
        <TouchableOpacity style={styles.primary} onPress={addEmployee}><Text style={styles.primaryText}>Add employee</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.secondary} onPress={analyze} disabled={analyzing}>{analyzing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Analyze salary structure</Text>}</TouchableOpacity>
      {clusters && <View style={styles.card}><Text style={styles.sectionTitle}>Salary analysis · {clusters.employeeCount} employees</Text>{clusters.clusters.map((cluster) => <View key={cluster.group} style={styles.cluster}><View><Text style={styles.clusterTitle}>{cluster.group}</Text><Text style={styles.muted}>{cluster.count} employees</Text></View><Text style={styles.salary}>{cluster.centroid == null ? '—' : `฿${cluster.centroid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</Text></View>)}</View>}
      <View style={styles.listHeading}><Text style={styles.sectionTitle}>Employees ({employees.length})</Text>{loading && <ActivityIndicator />}</View>
      {employees.map((employee) => <View key={employee.id} style={styles.employee}><View style={styles.employeeInfo}><Text style={styles.employeeName}>{employee.name}</Text><Text style={styles.muted}>{employee.position}</Text><Text style={styles.salary}>฿{Number(employee.salary).toLocaleString()}</Text><Text style={employee.status === 'Active' ? styles.active : styles.leave}>{employee.status}</Text></View><View style={styles.actions}><TouchableOpacity style={styles.smallButton} onPress={() => toggleStatus(employee.id)}><Text style={styles.smallText}>Toggle status</Text></TouchableOpacity><TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => confirmDelete(employee)}><Text style={[styles.smallText, styles.deleteText]}>Delete</Text></TouchableOpacity></View></View>)}
      {!loading && employees.length === 0 && <Text style={styles.empty}>No employees yet. Add the first one above.</Text>}
    </ScrollView>}
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f5f7fb' }, flex: { flex: 1 }, content: { padding: 20, paddingBottom: 40 }, login: { flex: 1, justifyContent: 'center', padding: 24 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, title: { fontSize: 30, fontWeight: '800', color: '#182238' }, subtitle: { color: '#778198', marginTop: 4, marginBottom: 18 }, logout: { color: '#3158c9', fontWeight: '700' }, card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 }, sectionTitle: { fontSize: 18, fontWeight: '700', color: '#182238', marginBottom: 12 }, input: { backgroundColor: '#f5f7fb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, color: '#182238' }, primary: { backgroundColor: '#3158c9', padding: 14, borderRadius: 10, alignItems: 'center' }, secondary: { backgroundColor: '#167d68', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 16 }, primaryText: { color: '#fff', fontWeight: '700' }, listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }, employee: { backgroundColor: '#fff', padding: 16, borderRadius: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 }, employeeInfo: { flex: 1 }, employeeName: { fontSize: 16, fontWeight: '700', color: '#182238', marginBottom: 3 }, muted: { color: '#778198', fontSize: 13, marginTop: 3 }, salary: { color: '#182238', fontWeight: '700', marginTop: 7 }, active: { color: '#167d68', fontSize: 12, marginTop: 5 }, leave: { color: '#bd7620', fontSize: 12, marginTop: 5 }, actions: { alignItems: 'flex-end', gap: 8 }, smallButton: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#edf1ff', borderRadius: 8 }, smallText: { color: '#3158c9', fontSize: 12, fontWeight: '700' }, deleteButton: { backgroundColor: '#fff0ef' }, deleteText: { color: '#bf443d' }, cluster: { borderTopWidth: 1, borderColor: '#edf0f5', paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, clusterTitle: { fontWeight: '700', color: '#182238' }, empty: { textAlign: 'center', color: '#778198', padding: 20 } });
