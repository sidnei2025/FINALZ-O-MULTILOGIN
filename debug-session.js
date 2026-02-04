// Script para verificar os dados de sessão salvos no Supabase
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ukxxmdmgwfeydjepxgjx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreHhtZG1nd2ZleWRqZXB4Z2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NjE5NzcsImV4cCI6MjA1NDAzNzk3N30.JGfKS4E9VmdKEPBeeJ9NVl7wPJWQ_-r30khGLq1FAvk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSessionData() {
    console.log('🔍 Buscando perfis com session_data...\n');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, session_data, session_updated_at')
        .not('session_data', 'is', null);

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('⚠️ Nenhum perfil com session_data encontrado!');
        console.log('👉 Certifique-se de clicar no botão SYNC após fazer login no site.');
        return;
    }

    console.log(`✅ Encontrados ${profiles.length} perfil(is) com sessão salva:\n`);

    for (const profile of profiles) {
        console.log('═'.repeat(60));
        console.log(`📁 Perfil: ${profile.name}`);
        console.log(`🆔 ID: ${profile.id}`);
        console.log(`📅 Última atualização: ${profile.session_updated_at || 'N/A'}`);

        if (profile.session_data) {
            const session = profile.session_data;

            console.log(`\n🍪 COOKIES: ${session.cookies?.length || 0}`);
            if (session.cookies && session.cookies.length > 0) {
                // Mostra os primeiros 10 cookies
                session.cookies.slice(0, 10).forEach((cookie, i) => {
                    console.log(`   ${i + 1}. ${cookie.name} (${cookie.domain}) - Expires: ${cookie.expires || 'session'}`);
                });
                if (session.cookies.length > 10) {
                    console.log(`   ... e mais ${session.cookies.length - 10} cookies`);
                }

                // Verifica cookies importantes para autenticação
                const authCookies = session.cookies.filter(c =>
                    c.name.includes('session') ||
                    c.name.includes('token') ||
                    c.name.includes('auth') ||
                    c.name.includes('__clerk') ||
                    c.name.includes('__client')
                );

                if (authCookies.length > 0) {
                    console.log(`\n   🔐 Cookies de autenticação encontrados:`);
                    authCookies.forEach(c => {
                        console.log(`      - ${c.name} (${c.domain})`);
                    });
                } else {
                    console.log(`\n   ⚠️ NENHUM cookie de autenticação encontrado!`);
                }
            }

            console.log(`\n💾 LOCALSTORAGE: ${Object.keys(session.localStorage || {}).length} itens`);
            if (session.localStorage) {
                Object.keys(session.localStorage).slice(0, 5).forEach(key => {
                    const value = session.localStorage[key];
                    const preview = typeof value === 'string' ? value.substring(0, 50) : JSON.stringify(value).substring(0, 50);
                    console.log(`   - ${key}: ${preview}...`);
                });
            }

            console.log(`\n📦 SESSIONSTORAGE: ${Object.keys(session.sessionStorage || {}).length} itens`);

            console.log(`\n📍 Capturado de: ${session.capturedFrom || 'N/A'}`);
            console.log(`⏰ Capturado em: ${session.capturedAt || 'N/A'}`);
        }
        console.log('\n');
    }
}

checkSessionData().catch(console.error);
